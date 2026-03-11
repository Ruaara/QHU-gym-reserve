import { Response } from 'express';
import QRCode from 'qrcode';
import dbPromise, { saveDatabase } from '../database/init';
import { AuthRequest } from '../middleware/auth';
import crypto from 'crypto';

// 生成唯一的二维码数据
const generateQrCodeData = (): string => {
  return crypto.randomBytes(16).toString('hex');
};

// 为预约创建二维码
export const createQrCode = async (reservationId: number, userId: number): Promise<string> => {
  const db = await dbPromise;

  // 检查该预约是否已有二维码
  const checkStmt = db.prepare('SELECT id FROM qr_codes WHERE reservation_id = :reservationId');
  const existing = checkStmt.getAsObject({ ':reservationId': reservationId }) as any;

  if (existing && existing.id) {
    // 返回已有的二维码数据
    const qrStmt = db.prepare('SELECT qr_code_data FROM qr_codes WHERE reservation_id = :reservationId');
    const qrData = qrStmt.getAsObject({ ':reservationId': reservationId }) as any;
    return qrData.qr_code_data;
  }

  // 生成新的二维码数据
  const qrCodeData = generateQrCodeData();

  // 保存到数据库
  const insertStmt = db.prepare(`
    INSERT INTO qr_codes (user_id, reservation_id, qr_code_data)
    VALUES (:userId, :reservationId, :qrCodeData)
  `);
  insertStmt.run({
    ':userId': userId,
    ':reservationId': reservationId,
    ':qrCodeData': qrCodeData
  });

  return qrCodeData;
};

// 生成二维码图片
export const generateQrCodeImage = async (req: AuthRequest, res: Response) => {
  try {
    const { reservationId } = req.params;
    const userId = req.user!.userId;

    const db = await dbPromise;

    // 检查预约是否属于该用户
    const checkStmt = db.prepare(`
      SELECT id FROM reservations
      WHERE id = :reservationId AND user_id = :userId
    `);
    const reservation = checkStmt.getAsObject({
      ':reservationId': reservationId,
      ':userId': userId
    }) as any;

    if (!reservation || !reservation.id) {
      return res.status(404).json({ error: '预约不存在' });
    }

    // 获取或创建二维码
    const qrCodeData = await createQrCode(parseInt(reservationId), userId);

    // 生成二维码图片（base64）
    const qrCodeImage = await QRCode.toDataURL(qrCodeData);

    res.json({
      qrCodeData,
      qrCodeImage
    });
  } catch (error) {
    console.error('生成二维码错误:', error);
    res.status(500).json({ error: '生成二维码失败' });
  }
};

// 获取用户的二维码（最近的未使用预约）
export const getMyQrCode = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const db = await dbPromise;

    // 获取今天的日期
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    // 获取明天的日期
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowYear = tomorrow.getFullYear();
    const tomorrowMonth = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const tomorrowDay = String(tomorrow.getDate()).padStart(2, '0');
    const tomorrowStr = `${tomorrowYear}-${tomorrowMonth}-${tomorrowDay}`;

    // 首先查找今天未使用的预约
    let reservationStmt = db.prepare(`
      SELECT r.id, r.gym_id, r.time_slot_id, r.reservation_date,
             g.name as gym_name,
             ts.start_time, ts.end_time
      FROM reservations r
      JOIN gyms g ON r.gym_id = g.id
      JOIN time_slots ts ON r.time_slot_id = ts.id
      LEFT JOIN qr_codes qc ON r.id = qc.reservation_id
      WHERE r.user_id = :userId AND r.reservation_date = :today
      AND (qc.is_used = 0 OR qc.is_used IS NULL)
      ORDER BY ts.start_time
      LIMIT 1
    `);
    let reservation = reservationStmt.getAsObject({
      ':userId': userId,
      ':today': todayStr
    }) as any;

    // 如果今天没有未使用的预约，查找明天的预约
    if (!reservation || !reservation.id) {
      reservationStmt = db.prepare(`
        SELECT r.id, r.gym_id, r.time_slot_id, r.reservation_date,
               g.name as gym_name,
               ts.start_time, ts.end_time
        FROM reservations r
        JOIN gyms g ON r.gym_id = g.id
        JOIN time_slots ts ON r.time_slot_id = ts.id
        LEFT JOIN qr_codes qc ON r.id = qc.reservation_id
        WHERE r.user_id = :userId AND r.reservation_date = :tomorrow
        AND (qc.is_used = 0 OR qc.is_used IS NULL)
        ORDER BY ts.start_time
        LIMIT 1
      `);
      reservation = reservationStmt.getAsObject({
        ':userId': userId,
        ':tomorrow': tomorrowStr
      }) as any;
    }

    if (!reservation || !reservation.id) {
      return res.status(404).json({ error: '暂无有效的预约' });
    }

    // 获取或创建二维码
    const qrCodeData = await createQrCode(reservation.id, userId);

    // 检查二维码是否已使用
    const qrStmt = db.prepare('SELECT is_used FROM qr_codes WHERE reservation_id = :reservationId');
    const qrData = qrStmt.getAsObject({ ':reservationId': reservation.id }) as any;

    // 生成二维码图片（base64）
    const qrCodeImage = await QRCode.toDataURL(qrCodeData);

    res.json({
      reservation: {
        id: reservation.id,
        gymName: reservation.gym_name,
        startTime: reservation.start_time,
        endTime: reservation.end_time,
        date: reservation.reservation_date
      },
      qrCodeData,
      qrCodeImage,
      isUsed: qrData?.is_used === 1
    });
  } catch (error) {
    console.error('获取二维码错误:', error);
    res.status(500).json({ error: '获取二维码失败' });
  }
};

// 验证二维码（管理员扫一扫）
export const verifyQrCode = async (req: AuthRequest, res: Response) => {
  try {
    const { qrCodeData } = req.body;

    if (!qrCodeData) {
      return res.status(400).json({ error: '请提供二维码数据' });
    }

    const db = await dbPromise;

    // 查找二维码
    const qrStmt = db.prepare(`
      SELECT qc.id, qc.user_id, qc.reservation_id, qc.is_used,
             r.user_id as reservation_user_id, r.reservation_date,
             u.name as user_name, u.account as user_account, u.unfaith_count
      FROM qr_codes qc
      JOIN reservations r ON qc.reservation_id = r.id
      JOIN users u ON qc.user_id = u.id
      WHERE qc.qr_code_data = :qrCodeData
    `);
    const qrCode = qrStmt.getAsObject({ ':qrCodeData': qrCodeData }) as any;

    if (!qrCode || !qrCode.id) {
      return res.status(404).json({ error: '二维码无效' });
    }

    // 检查二维码是否已使用
    if (qrCode.is_used === 1) {
      // 检查是否是当前使用者的二维码
      const currentUserId = req.user!.userId;
      if (qrCode.user_id !== currentUserId) {
        // 这是重复核销（使用他人的二维码）
        // 增加不诚信计数
        const updateUnfaithStmt = db.prepare(`
          UPDATE users SET unfaith_count = unfaith_count + 1 WHERE id = :userId
        `);
        updateUnfaithStmt.run({ ':userId': currentUserId });

        // 重新查询不诚信计数
        const checkUnfaithStmt = db.prepare('SELECT unfaith_count FROM users WHERE id = :userId');
        const unfaithData = checkUnfaithStmt.getAsObject({ ':userId': currentUserId }) as any;

        // 检查是否需要封号
        if (unfaithData.unfaith_count >= 3) {
          const banStmt = db.prepare('UPDATE users SET is_banned = 1 WHERE id = :userId');
          banStmt.run({ ':userId': currentUserId });

          return res.status(403).json({
            error: '您的账号因多次不诚信行为已被封禁',
            unfaithCount: unfaithData.unfaith_count
          });
        }

        return res.status(400).json({
          error: '二维码已使用',
          unfaithCount: unfaithData.unfaith_count
        });
      } else {
        return res.status(400).json({ error: '您已核销过此二维码' });
      }
    }

    // 验证成功，标记二维码为已使用
    const updateStmt = db.prepare('UPDATE qr_codes SET is_used = 1 WHERE id = :id');
    updateStmt.run({ ':id': qrCode.id });

    // 保存数据库更改
    saveDatabase();

    res.json({
      message: '核销成功',
      userName: qrCode.user_name,
      userAccount: qrCode.user_account,
      reservationDate: qrCode.reservation_date
    });
  } catch (error) {
    console.error('验证二维码错误:', error);
    res.status(500).json({ error: '验证二维码失败' });
  }
};

// 删除预约的二维码
export const deleteQrCode = async (reservationId: number) => {
  const db = await dbPromise;
  const deleteStmt = db.prepare('DELETE FROM qr_codes WHERE reservation_id = :reservationId');
  deleteStmt.run({ ':reservationId': reservationId });
};

// 每晚8点删除所有二维码
export const cleanupQrCodes = async () => {
  try {
    const db = await dbPromise;
    const deleteStmt = db.prepare('DELETE FROM qr_codes');
    deleteStmt.run();
    console.log('🗑️  All QR codes deleted at 8:00 PM');
  } catch (error) {
    console.error('❌ Error deleting QR codes:', error);
  }
};
