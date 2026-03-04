import { Response } from 'express';
import dbPromise from '../database/init';
import { saveDatabase } from '../database/init';
import { AuthRequest } from '../middleware/auth';

// 获取时间段列表
export const getTimeSlots = async (req: AuthRequest, res: Response) => {
  try {
    const db = await dbPromise;

    const gymId = req.query.gymId as string;
    const date = req.query.date as string;

    if (!gymId) {
      return res.status(400).json({ error: '请指定健身房' });
    }

    // 根据用户是否是社团成员过滤时间段
    const isClub = req.user?.isClub || false;

    let stmt = db.prepare(`
      SELECT ts.id, ts.gym_id, ts.start_time, ts.end_time,
             ts.is_club_only, ts.max_capacity, ts.is_active,
             g.name as gym_name
      FROM time_slots ts
      JOIN gyms g ON ts.gym_id = g.id
      WHERE ts.gym_id = :gymId AND ts.is_active = 1
      ORDER BY ts.start_time
    `);

    const timeSlots: any[] = [];
    stmt.bind({ ':gymId': gymId });
    while (stmt.step()) {
      timeSlots.push(stmt.getAsObject());
    }

    // 如果不是社团成员，过滤掉仅限社团的时间段
    let filteredSlots = timeSlots;
    if (!isClub) {
      filteredSlots = timeSlots.filter((ts: any) => !ts.is_club_only);
    }

    // 如果指定了日期，查询每个时间段的已预约人数
    if (date) {
      filteredSlots = filteredSlots.map((ts: any) => {
        const countStmt = db.prepare(`
          SELECT COUNT(*) as count
          FROM reservations
          WHERE time_slot_id = :slotId AND reservation_date = :date
        `);
        const result = countStmt.getAsObject({ ':slotId': ts.id, ':date': date }) as { count: number };

        return {
          id: ts.id,
          gymId: ts.gym_id,
          gymName: ts.gym_name,
          startTime: ts.start_time,
          endTime: ts.end_time,
          maxCapacity: ts.max_capacity,
          isClubOnly: ts.is_club_only === 1,
          isActive: ts.is_active === 1,
          availableSlots: ts.max_capacity - (result.count || 0)
        };
      });
    } else {
      filteredSlots = filteredSlots.map((ts: any) => ({
        id: ts.id,
        gymId: ts.gym_id,
        gymName: ts.gym_name,
        startTime: ts.start_time,
        endTime: ts.end_time,
        maxCapacity: ts.max_capacity,
        isClubOnly: ts.is_club_only === 1,
        isActive: ts.is_active === 1,
        availableSlots: ts.max_capacity
      }));
    }

    res.json({ timeSlots: filteredSlots });
  } catch (error) {
    console.error('获取时间段列表错误:', error);
    res.status(500).json({ error: '获取时间段列表失败' });
  }
};
