import { Response } from 'express';
import dbPromise from '../database/init';
import { saveDatabase } from '../database/init';
import { AuthRequest } from '../middleware/auth';

// 获取预约开放时间设置
export const getBookingOpenTime = async (req: AuthRequest, res: Response) => {
  try {
    // 从第一个时间段获取预约开放时间（作为系统默认值）
    const db = await dbPromise;
    const stmt = db.prepare('SELECT booking_open_time FROM time_slots LIMIT 1');
    const result = stmt.getAsObject({}) as any;

    res.json({ bookingOpenTime: result?.booking_open_time || '20:00' });
  } catch (error) {
    console.error('获取预约开放时间错误:', error);
    res.status(500).json({ error: '获取预约开放时间失败' });
  }
};

// 设置预约开放时间（更新所有时间段）
export const setBookingOpenTime = async (req: AuthRequest, res: Response) => {
  try {
    const { bookingOpenTime } = req.body;

    if (!bookingOpenTime) {
      return res.status(400).json({ error: '请提供预约开放时间' });
    }

    // 验证时间格式 (HH:MM)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(bookingOpenTime)) {
      return res.status(400).json({ error: '时间格式不正确，请使用 HH:MM 格式' });
    }

    const db = await dbPromise;

    // 更新所有时间段的预约开放时间
    const updateStmt = db.prepare('UPDATE time_slots SET booking_open_time = :bookingOpenTime');
    updateStmt.run({ ':bookingOpenTime': bookingOpenTime });

    saveDatabase();

    res.json({ message: '预约开放时间设置成功' });
  } catch (error) {
    console.error('设置预约开放时间错误:', error);
    res.status(500).json({ error: '设置预约开放时间失败' });
  }
};
