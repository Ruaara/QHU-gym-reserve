import { Response } from 'express';
import dbPromise from '../database/init';
import { saveDatabase } from '../database/init';
import { AuthRequest } from '../middleware/auth';
import { getBookingOpenTime } from './systemSettingsController';

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

// 检查是否已过重置时间（预约开放时间前1分钟）
const isAfterResetTime = async (): Promise<boolean> => {
  const bookingOpenTime = await getBookingOpenTime();
  const resetMinutes = bookingOpenTime.hours * 60 + bookingOpenTime.minutes - 1; // 开放时间前1分钟

  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const totalMinutes = hours * 60 + minutes;

  return totalMinutes >= resetMinutes;
};

// 检查是否已过预约开放时间
const isAfterBookingOpenTime = async (): Promise<boolean> => {
  const bookingOpenTime = await getBookingOpenTime();
  const openMinutes = bookingOpenTime.hours * 60 + bookingOpenTime.minutes;

  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const totalMinutes = hours * 60 + minutes;

  return totalMinutes >= openMinutes;
};

// 检查是否可以预约指定日期
export const canReserveForDate = async (targetDate: string): Promise<boolean> => {
  const today = getTodayDate();
  const target = new Date(targetDate);
  const todayObj = new Date(today);

  // 计算日期差（天数）
  const diffTime = target.getTime() - todayObj.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    // 不能预约过去的日期
    return false;
  } else if (diffDays === 0) {
    // 可以预约今天
    return true;
  } else if (diffDays === 1) {
    // 预约明天，需要过预约开放时间
    return await isAfterBookingOpenTime();
  } else {
    // 预约后天及以后，不可预约
    return false;
  }
};

// 检查并重置每日限制
const checkAndResetDailyLimit = async (userId: number, today: string) => {
  const db = await dbPromise;

  // 首先验证用户是否存在，并获取用户角色
  const userCheckStmt = db.prepare('SELECT id, role FROM users WHERE id = :userId');
  userCheckStmt.bind({ ':userId': userId });
  if (!userCheckStmt.step()) {
    throw new Error(`User with id ${userId} does not exist`);
  }
  const userExists = userCheckStmt.getAsObject() as any;

  if (!userExists || !userExists.id) {
    throw new Error(`User with id ${userId} does not exist`);
  }

  // 判断用户是否是管理员（admin 或 main_admin）
  const isAdmin = userExists.role === 'admin' || userExists.role === 'main_admin';
  // 管理员每天1000次更改机会，普通用户1次
  const defaultChangeCount = isAdmin ? 1000 : 1;

  // 获取用户的限制记录
  const stmt = db.prepare('SELECT * FROM reservation_limits WHERE user_id = :userId');
  stmt.bind({ ':userId': userId });
  const hasRow = stmt.step();

  if (!hasRow) {
    // 如果没有记录，创建新记录
    const insertStmt = db.prepare(`
      INSERT INTO reservation_limits (user_id, today_reserved, today_change, last_reset_date)
      VALUES (:userId, 0, :changeCount, :today)
    `);
    insertStmt.run({ ':userId': userId, ':changeCount': defaultChangeCount, ':today': today });
    // 不在这里保存数据库，让调用者决定何时保存
    console.log(`[checkAndResetDailyLimit] No record, created new for user ${userId}`);
    return { today_reserved: false, today_change: defaultChangeCount, needsSave: true };
  }

  const limit = stmt.getAsObject() as any;
  console.log(`[checkAndResetDailyLimit] Found record for user ${userId}: today_reserved=${limit.today_reserved}, last_reset_date=${limit.last_reset_date}`);

  // 检查是否需要重置：仅当日期不同时重置
  // 日期变化时自动重置，不需要额外的时间检查
  const needReset = limit.last_reset_date !== today;

  console.log(`[checkAndResetDailyLimit] needReset=${needReset}, today=${today}`);

  if (needReset) {
    const updateStmt = db.prepare(`
      UPDATE reservation_limits
      SET today_reserved = 0, today_change = :changeCount, last_reset_date = :today
      WHERE user_id = :userId
    `);
    updateStmt.run({ ':userId': userId, ':changeCount': defaultChangeCount, ':today': today });
    // 不在这里保存数据库，让调用者决定何时保存
    console.log(`[checkAndResetDailyLimit] Reset record for user ${userId}`);
    return { today_reserved: false, today_change: defaultChangeCount, needsSave: true };
  }

  const result = { today_reserved: limit.today_reserved === 1, today_change: limit.today_change, needsSave: false };
  console.log(`[checkAndResetDailyLimit] Returning for user ${userId}: today_reserved=${result.today_reserved}`);
  return result;
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
  const msg = `[setUserReserved] Called for user ${userId} at ${new Date().toISOString()}`;
  console.log(msg);
  const db = await dbPromise;
  const today = getTodayDate();

  // 获取用户角色
  const userStmt = db.prepare('SELECT id, role FROM users WHERE id = :userId');
  userStmt.bind({ ':userId': userId });
  if (!userStmt.step()) {
    throw new Error(`User with id ${userId} does not exist`);
  }
  const user = userStmt.getAsObject() as any;
  const isAdmin = user.role === 'admin' || user.role === 'main_admin';
  const defaultChangeCount = isAdmin ? 1000 : 1;

  // 先检查记录是否存在
  const checkStmt = db.prepare('SELECT * FROM reservation_limits WHERE user_id = :userId');
  checkStmt.bind({ ':userId': userId });
  const hasRow = checkStmt.step();

  console.log(`[setUserReserved] hasRow = ${hasRow}`);

  if (hasRow) {
    // 记录存在，更新
    const limit = checkStmt.getAsObject() as any;
    const msg1 = `[setUserReserved] Existing record: today_reserved=${limit.today_reserved}, last_reset_date=${limit.last_reset_date}`;
    console.log(msg1);

    const updateStmt = db.prepare(`
      UPDATE reservation_limits
      SET today_reserved = 1, last_reset_date = :today
      WHERE user_id = :userId
    `);
    updateStmt.run({ ':userId': userId, ':today': today });
    console.log(`[setUserReserved] Updated record for user ${userId} with today_reserved=1, last_reset_date=${today}`);

    // Verify the update
    const verifyStmt = db.prepare('SELECT today_reserved FROM reservation_limits WHERE user_id = :userId');
    verifyStmt.bind({ ':userId': userId });
    if (verifyStmt.step()) {
      const result = verifyStmt.getAsObject();
      const msg2 = `[setUserReserved] After update: today_reserved=${result.today_reserved}`;
      console.log(msg2);
    }
  } else {
    // 记录不存在，插入新记录
    const insertStmt = db.prepare(`
      INSERT INTO reservation_limits (user_id, today_reserved, today_change, last_reset_date)
      VALUES (:userId, 1, :changeCount, :today)
    `);
    insertStmt.run({ ':userId': userId, ':changeCount': defaultChangeCount, ':today': today });
    console.log(`[setUserReserved] Inserted new record for user ${userId}`);
  }
  saveDatabase();
  console.log(`[setUserReserved] Database saved`);
};

// 检查用户是否可以预约
export const canUserReserve = async (userId: number): Promise<boolean> => {
  const db = await dbPromise;
  const today = getTodayDate();

  // 获取用户角色
  const userStmt = db.prepare('SELECT id, role FROM users WHERE id = :userId');
  userStmt.bind({ ':userId': userId });
  if (!userStmt.step()) {
    throw new Error(`User with id ${userId} does not exist`);
  }
  const user = userStmt.getAsObject() as any;

  // 判断用户是否是管理员
  const isAdmin = user.role === 'admin' || user.role === 'main_admin';
  const defaultChangeCount = isAdmin ? 1000 : 1;

  // 直接查询用户的限制记录
  const stmt = db.prepare('SELECT * FROM reservation_limits WHERE user_id = :userId');
  stmt.bind({ ':userId': userId });
  const hasRow = stmt.step();

  if (!hasRow) {
    // 没有记录，可以预约
    // 创建新记录
    const insertStmt = db.prepare(`
      INSERT INTO reservation_limits (user_id, today_reserved, today_change, last_reset_date)
      VALUES (:userId, 0, :changeCount, :today)
    `);
    insertStmt.run({ ':userId': userId, ':changeCount': defaultChangeCount, ':today': today });
    saveDatabase();
    return true;
  }

  const limit = stmt.getAsObject() as any;

  // 检查是否需要重置：仅当日期不同时重置
  const needReset = limit.last_reset_date !== today;

  if (needReset) {
    // 重置记录
    const updateStmt = db.prepare(`
      UPDATE reservation_limits
      SET today_reserved = 0, today_change = :changeCount, last_reset_date = :today
      WHERE user_id = :userId
    `);
    updateStmt.run({ ':userId': userId, ':changeCount': defaultChangeCount, ':today': today });
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

// 检查日期是否可预约
export const checkDateAvailability = async (req: AuthRequest, res: Response) => {
  try {
    const date = req.query.date as string;

    if (!date) {
      return res.status(400).json({ error: '请提供日期' });
    }

    const canReserve = await canReserveForDate(date);
    const bookingOpenTime = await getBookingOpenTime();
    const timeStr = `${String(bookingOpenTime.hours).padStart(2, '0')}:${String(bookingOpenTime.minutes).padStart(2, '0')}`;

    res.json({
      date,
      canReserve,
      message: canReserve ? '该日期可预约' : `该日期的预约尚未开放，请在${timeStr}后预约明天的时段`
    });
  } catch (error) {
    console.error('检查日期可用性错误:', error);
    res.status(500).json({ error: '检查日期可用性失败' });
  }
};
