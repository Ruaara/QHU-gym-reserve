import { Response } from 'express';
import dbPromise from '../database/init';
import { saveDatabase } from '../database/init';
import { AuthRequest } from '../middleware/auth';

// 获取今天的日期
const getTodayDate = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// 获取当前时间（小时和分钟）
const getCurrentTime = (): string => {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

// 检查并重置每日限制
const checkAndResetDailyLimit = async (userId: number, today: string) => {
  const db = await dbPromise;

  // 首先验证用户是否存在
  const userCheckStmt = db.prepare('SELECT id FROM users WHERE id = :userId');
  const userExists = userCheckStmt.getAsObject({ ':userId': userId }) as any;

  if (!userExists || !userExists.id) {
    throw new Error(`User with id ${userId} does not exist`);
  }

  // 获取用户的限制记录
  const stmt = db.prepare('SELECT * FROM reservation_limits WHERE user_id = :userId');
  const limitResult = stmt.getAsObject({ ':userId': userId }) as any;

  // 检查是否返回了结果（SQL.js 可能返回空对象而不是 null）
  const hasRecord = limitResult && typeof limitResult === 'object' && 'id' in limitResult && limitResult.id !== undefined;

  if (!hasRecord) {
    // 如果没有记录，创建新记录
    const insertStmt = db.prepare(`
      INSERT INTO reservation_limits (user_id, today_reserved, today_change, last_reset_date)
      VALUES (:userId, 0, 1, :today)
    `);
    insertStmt.run({ ':userId': userId, ':today': today });
    // 不在这里保存数据库，让调用者决定何时保存
    return { today_reserved: false, today_change: 1, needsSave: true };
  }

  const limit = limitResult;

  // 检查是否需要重置：日期变更时重置
  // 4:00 AM的重置机制通过日期比较自然实现
  // （例如：凌晨3点时，today仍是昨天，所以会重置；早上5点时，today已是今天，不会重置）
  const needReset = limit.last_reset_date !== today;

  if (needReset) {
    const updateStmt = db.prepare(`
      UPDATE reservation_limits
      SET today_reserved = 0, today_change = 1, last_reset_date = :today
      WHERE user_id = :userId
    `);
    updateStmt.run({ ':userId': userId, ':today': today });
    // 不在这里保存数据库，让调用者决定何时保存
    return { today_reserved: false, today_change: 1, needsSave: true };
  }

  return { today_reserved: limit.today_reserved === 1, today_change: limit.today_change, needsSave: false };
};

// 获取用户预约限制状态
export const getUserReservationLimit = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const today = getTodayDate();

    const status = await checkAndResetDailyLimit(userId, today);

    // 如果创建了新记录或更新了记录，保存数据库
    if (status.needsSave) {
      saveDatabase();
    }

    res.json({
      today_reserved: status.today_reserved,
      today_change: status.today_change
    });
  } catch (error) {
    console.error('获取预约限制状态错误:', error);
    res.status(500).json({ error: '获取预约限制状态失败' });
  }
};

// 设置用户已预约
export const setUserReserved = async (userId: number): Promise<void> => {
  const db = await dbPromise;
  const today = getTodayDate();

  // 先确保记录存在
  await checkAndResetDailyLimit(userId, today);

  const stmt = db.prepare(`
    UPDATE reservation_limits
    SET today_reserved = 1
    WHERE user_id = :userId
  `);
  stmt.run({ ':userId': userId });
  saveDatabase();
};

// 检查用户是否可以预约
export const canUserReserve = async (userId: number): Promise<boolean> => {
  const db = await dbPromise;
  const today = getTodayDate();

  // 直接查询用户的限制记录
  const stmt = db.prepare('SELECT * FROM reservation_limits WHERE user_id = :userId');
  const limitResult = stmt.getAsObject({ ':userId': userId }) as any;

  // 检查是否返回了结果
  const hasRecord = limitResult && typeof limitResult === 'object' && 'id' in limitResult && limitResult.id !== undefined;

  if (!hasRecord) {
    // 没有记录，可以预约
    // 创建新记录
    const insertStmt = db.prepare(`
      INSERT INTO reservation_limits (user_id, today_reserved, today_change, last_reset_date)
      VALUES (:userId, 0, 1, :today)
    `);
    insertStmt.run({ ':userId': userId, ':today': today });
    saveDatabase();
    return true;
  }

  const limit = limitResult;

  // 检查是否需要重置
  const needReset = limit.last_reset_date !== today;

  if (needReset) {
    // 重置记录
    const updateStmt = db.prepare(`
      UPDATE reservation_limits
      SET today_reserved = 0, today_change = 1, last_reset_date = :today
      WHERE user_id = :userId
    `);
    updateStmt.run({ ':userId': userId, ':today': today });
    saveDatabase();
    return true;
  }

  // 检查今天是否已预约
  return limit.today_reserved !== 1;
};

// 减少用户变更次数
export const decrementUserChange = async (userId: number): Promise<void> => {
  const db = await dbPromise;
  const today = getTodayDate();

  // 先确保记录存在
  await checkAndResetDailyLimit(userId, today);

  const stmt = db.prepare(`
    UPDATE reservation_limits
    SET today_change = today_change - 1,
        today_reserved = 0
    WHERE user_id = :userId
  `);
  stmt.run({ ':userId': userId });
  saveDatabase();
};

// 获取用户剩余变更次数
export const getUserChangeCount = async (userId: number): Promise<number> => {
  const db = await dbPromise;
  const today = getTodayDate();

  // 先检查并重置
  const status = await checkAndResetDailyLimit(userId, today);

  // 如果创建了新记录，保存数据库
  if (status.needsSave) {
    saveDatabase();
  }

  return status.today_change;
};

// 记录取消的预约
export const recordCancelledReservation = async (userId: number, timeSlotId: number, reservationDate: string): Promise<void> => {
  const db = await dbPromise;

  // 首先验证用户是否存在
  const userCheckStmt = db.prepare('SELECT id FROM users WHERE id = :userId');
  const userExists = userCheckStmt.getAsObject({ ':userId': userId }) as any;

  if (!userExists || !userExists.id) {
    throw new Error(`User with id ${userId} does not exist`);
  }

  const stmt = db.prepare(`
    INSERT INTO cancelled_reservations (user_id, time_slot_id, reservation_date)
    VALUES (:userId, :timeSlotId, :reservationDate)
  `);
  stmt.run({
    ':userId': userId,
    ':timeSlotId': timeSlotId,
    ':reservationDate': reservationDate
  });
  saveDatabase();
};

// 检查用户是否已取消过该时间段
export const hasUserCancelledSlot = async (userId: number, timeSlotId: number, reservationDate: string): Promise<boolean> => {
  const db = await dbPromise;

  const stmt = db.prepare(`
    SELECT id FROM cancelled_reservations
    WHERE user_id = :userId AND time_slot_id = :timeSlotId AND reservation_date = :reservationDate
  `);
  const result = stmt.getAsObject({
    ':userId': userId,
    ':timeSlotId': timeSlotId,
    ':reservationDate': reservationDate
  }) as any;

  return !!(result && result.id);
};
