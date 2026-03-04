import { Request, Response } from 'express';
import dbPromise from '../database/init';

// 获取健身房列表
export const getGyms = async (req: Request, res: Response) => {
  try {
    const db = await dbPromise;

    const stmt = db.prepare(`
      SELECT id, name, description, image_url, is_active, created_at
      FROM gyms
      WHERE is_active = 1
      ORDER BY id
    `);

    const results: any[] = [];
    while (stmt.step()) {
      const gym = stmt.getAsObject();
      results.push({
        id: gym.id,
        name: gym.name,
        description: gym.description,
        imageUrl: gym.image_url,
        isActive: gym.is_active === 1,
        createdAt: gym.created_at
      });
    }

    res.json({ gyms: results });
  } catch (error) {
    console.error('获取健身房列表错误:', error);
    res.status(500).json({ error: '获取健身房列表失败' });
  }
};
