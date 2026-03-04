import { Response } from 'express';
import dbPromise from '../database/init';
import { saveDatabase } from '../database/init';
import { AuthRequest } from '../middleware/auth';
import {
  canUserReserve,
  recordCancelledReservation,
  hasUserCancelledSlot
} from './reservationLimitController';

// 创建预约
export const createReservation = async (req: AuthRequest, res: Response) => {
  try {
    const { gymId, timeSlotId, reservationDate } = req.body;

    // 验证必填字段
    if (!gymId || !timeSlotId || !reservationDate) {
      return res.status(400).json({ error: '请填写完整信息' });
    }

    const userId = req.user!.userId;

    // 检查用户今天是否已预约（每日预约限制）
    const canReserve = await canUserReserve(userId);
    if (!canReserve) {
      return res.status(400).json({ error: '您今天已预约过，每天只能预约一次' });
    }

    // 检查是否已取消过该时间段（防止重复预约已取消的时间段）
    const hasCancelled = await hasUserCancelledSlot(userId, timeSlotId, reservationDate);
    if (hasCancelled) {
      return res.status(400).json({ error: '您今天已取消过该时间段，不能重复预约' });
    }

    const db = await dbPromise;

    // 检查时间段是否存在
    const slotStmt = db.prepare('SELECT * FROM time_slots WHERE id = :slotId AND is_active = 1');
    const timeSlot = slotStmt.getAsObject({ ':slotId': timeSlotId }) as any;

    if (!timeSlot || !timeSlot.id) {
      return res.status(404).json({ error: '时间段不存在' });
    }

    // 检查是否是社团专属时间段
    if (timeSlot.is_club_only && !req.user!.isClub) {
      return res.status(403).json({ error: '该时间段仅限社团成员预约' });
    }

    // 检查是否已预约该时间段
    const checkStmt = db.prepare(`
      SELECT id FROM reservations
      WHERE user_id = :userId AND time_slot_id = :slotId AND reservation_date = :date
    `);
    const existingReservation = checkStmt.getAsObject({
      ':userId': userId,
      ':slotId': timeSlotId,
      ':date': reservationDate
    }) as any;

    if (existingReservation && existingReservation.id) {
      return res.status(400).json({ error: '您已预约该时间段' });
    }

    // 检查名额是否已满
    const countStmt = db.prepare(`
      SELECT COUNT(*) as count FROM reservations
      WHERE time_slot_id = :slotId AND reservation_date = :date
    `);
    const reservationCount = countStmt.getAsObject({
      ':slotId': timeSlotId,
      ':date': reservationDate
    }) as { count: number };

    if ((reservationCount.count || 0) >= timeSlot.max_capacity) {
      return res.status(400).json({ error: '该时间段名额已满' });
    }

    // 创建预约
    const insertStmt = db.prepare(`
      INSERT INTO reservations (user_id, gym_id, time_slot_id, reservation_date)
      VALUES (:userId, :gymId, :slotId, :date)
    `);
    insertStmt.run({
      ':userId': userId,
      ':gymId': gymId,
      ':slotId': timeSlotId,
      ':date': reservationDate
    });

    // 设置用户已预约状态（直接更新，不再调用 checkAndResetDailyLimit）
    const updateLimitStmt = db.prepare(`
      UPDATE reservation_limits
      SET today_reserved = 1
      WHERE user_id = :userId
    `);
    updateLimitStmt.run({ ':userId': userId });

    // 获取新插入的预约ID
    const lastIdStmt = db.prepare('SELECT last_insert_rowid() as id');
    const lastId = lastIdStmt.getAsObject({}) as { id: number };

    // 获取完整的预约信息
    const reservationStmt = db.prepare(`
      SELECT r.id, r.reservation_date, r.created_at,
             g.name as gym_name,
             ts.start_time, ts.end_time
      FROM reservations r
      JOIN gyms g ON r.gym_id = g.id
      JOIN time_slots ts ON r.time_slot_id = ts.id
      WHERE r.id = :id
    `);
    const reservation = reservationStmt.getAsObject({ ':id': lastId.id }) as any;

    saveDatabase();

    res.status(201).json({
      message: '预约成功',
      reservation: {
        ...reservation,
        startTime: reservation.start_time,
        endTime: reservation.end_time
      }
    });
  } catch (error) {
    console.error('创建预约错误:', error);
    console.error('错误详情:', JSON.stringify(error));
    res.status(500).json({ error: '创建预约失败', details: String(error) });
  }
};

// 获取我的预约
export const getMyReservations = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const date = req.query.date as string;

    const db = await dbPromise;

    let query = `
      SELECT r.id, r.time_slot_id, r.gym_id, r.reservation_date, r.created_at,
             g.name as gym_name,
             ts.start_time, ts.end_time
      FROM reservations r
      JOIN gyms g ON r.gym_id = g.id
      JOIN time_slots ts ON r.time_slot_id = ts.id
      WHERE r.user_id = :userId
    `;

    if (date) {
      query += ' AND r.reservation_date = :date';
    }

    query += ' ORDER BY r.reservation_date DESC, ts.start_time';

    const stmt = db.prepare(query);
    const reservations: any[] = [];

    if (date) {
      stmt.bind({ ':userId': userId, ':date': date });
    } else {
      stmt.bind({ ':userId': userId });
    }

    while (stmt.step()) {
      reservations.push(stmt.getAsObject());
    }

    // 获取用户今日剩余变更次数（直接查询）
    const today = getTodayDateString();
    const limitStmt = db.prepare('SELECT today_change FROM reservation_limits WHERE user_id = :userId AND last_reset_date = :today');
    const limitResult = limitStmt.getAsObject({ ':userId': userId, ':today': today }) as any;

    const hasValidRecord = limitResult && typeof limitResult === 'object' && 'today_change' in limitResult;
    const todayChange = hasValidRecord ? limitResult.today_change : 1;

    res.json({
      reservations: reservations.map((r: any) => ({
        ...r,
        startTime: r.start_time,
        endTime: r.end_time,
        todayChange
      })),
      todayChange
    });
  } catch (error) {
    console.error('获取我的预约错误:', error);
    res.status(500).json({ error: '获取我的预约失败' });
  }
};

// 取消预约
export const cancelReservation = async (req: AuthRequest, res: Response) => {
  try {
    const reservationId = req.params.id;
    const userId = req.user!.userId;

    const db = await dbPromise;

    // 检查预约是否存在且属于当前用户
    const stmt = db.prepare('SELECT * FROM reservations WHERE id = :id AND user_id = :userId');
    const reservation = stmt.getAsObject({ ':id': reservationId, ':userId': userId }) as any;

    if (!reservation || !reservation.id) {
      return res.status(404).json({ error: '预约不存在' });
    }

    // 检查用户今日剩余变更次数（直接查询，避免调用 checkAndResetDailyLimit）
    const today = getTodayDateString();
    const limitStmt = db.prepare('SELECT today_change FROM reservation_limits WHERE user_id = :userId AND last_reset_date = :today');
    const limitResult = limitStmt.getAsObject({ ':userId': userId, ':today': today }) as any;

    // 如果没有记录或日期不匹配，需要重置
    const hasValidRecord = limitResult && typeof limitResult === 'object' && 'today_change' in limitResult;
    const todayChange = hasValidRecord ? limitResult.today_change : 1;

    if (todayChange === 0) {
      return res.status(400).json({ error: '今日更改机会已用尽' });
    }

    // 记录取消的预约（防止重复预约）
    await recordCancelledReservation(userId, reservation.time_slot_id, reservation.reservation_date);

    // 删除预约
    const deleteStmt = db.prepare('DELETE FROM reservations WHERE id = :id');
    deleteStmt.run({ ':id': reservationId });

    // 减少用户变更次数，并重置 today_reserved（直接更新，避免调用 decrementUserChange）
    const updateLimitStmt = db.prepare(`
      UPDATE reservation_limits
      SET today_change = today_change - 1,
          today_reserved = 0
      WHERE user_id = :userId
    `);
    updateLimitStmt.run({ ':userId': userId });

    saveDatabase();

    res.json({ message: '取消预约成功' });
  } catch (error) {
    console.error('取消预约错误:', error);
    res.status(500).json({ error: '取消预约失败' });
  }
};

// 获取今天的日期字符串（辅助函数）
function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
