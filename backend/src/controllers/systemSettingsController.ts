import { Response } from 'express';
import dbPromise from '../database/init';
import { saveDatabase } from '../database/init';
import { AuthRequest } from '../middleware/auth';

// 获取系统设置
export const getSystemSettings = async (req: AuthRequest, res: Response) => {
  try {
    const db = await dbPromise;

    const stmt = db.prepare('SELECT setting_key, setting_value, description FROM system_settings');
    const settings: Record<string, { value: string; description: string }> = {};

    while (stmt.step()) {
      const row = stmt.getAsObject() as any;
      settings[row.setting_key] = {
        value: row.setting_value,
        description: row.description
      };
    }

    res.json({ settings });
  } catch (error) {
    console.error('获取系统设置错误:', error);
    res.status(500).json({ error: '获取系统设置失败' });
  }
};

// 更新系统设置
export const updateSystemSettings = async (req: AuthRequest, res: Response) => {
  try {
    const { settings } = req.body;

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: '请提供有效的设置数据' });
    }

    const db = await dbPromise;

    // 检查用户是否是管理员
    const userId = req.user!.userId;
    const userStmt = db.prepare('SELECT role FROM users WHERE id = :userId');
    const user = userStmt.getAsObject({ ':userId': userId }) as any;

    if (!user || (user.role !== 'admin' && user.role !== 'main_admin')) {
      return res.status(403).json({ error: '只有管理员可以修改系统设置' });
    }

    // 更新每个设置
    for (const [key, value] of Object.entries(settings)) {
      const checkStmt = db.prepare('SELECT id FROM system_settings WHERE setting_key = :key');
      const existing = checkStmt.getAsObject({ ':key': key }) as any;

      if (existing && existing.id) {
        // 更新现有设置
        const updateStmt = db.prepare(`
          UPDATE system_settings
          SET setting_value = :value, updated_at = CURRENT_TIMESTAMP
          WHERE setting_key = :key
        `);
        updateStmt.run({ ':key': key, ':value': String(value) });
      } else {
        // 创建新设置
        const insertStmt = db.prepare(`
          INSERT INTO system_settings (setting_key, setting_value)
          VALUES (:key, :value)
        `);
        insertStmt.run({ ':key': key, ':value': String(value) });
      }
    }

    saveDatabase();

    res.json({ message: '系统设置更新成功' });
  } catch (error) {
    console.error('更新系统设置错误:', error);
    res.status(500).json({ error: '更新系统设置失败' });
  }
};

// 获取预约开放时间（辅助函数）
export const getBookingOpenTime = async (): Promise<{ hours: number; minutes: number }> => {
  const db = await dbPromise;
  const stmt = db.prepare('SELECT setting_value FROM system_settings WHERE setting_key = :key');
  const result = stmt.getAsObject({ ':key': 'booking_open_time' }) as any;

  if (result && result.setting_value) {
    const [hours, minutes] = result.setting_value.split(':').map(Number);
    return { hours, minutes };
  }

  // 默认返回 20:00
  return { hours: 20, minutes: 0 };
};
