import dbPromise from '../database/init';
import { saveDatabase } from '../database/init';

/**
 * 清理3天前的预约记录
 * 保留最近3天的预约记录，删除更早的记录
 */
export const cleanOldReservations = async () => {
  try {
    const db = await dbPromise;

    // 计算3天前的日期 (YYYY-MM-DD格式)
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const cutoffDate = threeDaysAgo.toISOString().split('T')[0];

    // 查询要删除的记录数量
    const countStmt = db.prepare(`
      SELECT COUNT(*) as count
      FROM reservations
      WHERE reservation_date < :cutoffDate
    `);
    const result = countStmt.getAsObject({ ':cutoffDate': cutoffDate }) as { count: number };

    if (result.count > 0) {
      // 删除3天前的预约记录
      const deleteStmt = db.prepare(`
        DELETE FROM reservations
        WHERE reservation_date < :cutoffDate
      `);
      deleteStmt.run({ ':cutoffDate': cutoffDate });

      saveDatabase();

      console.log(`✅ 已清理 ${result.count} 条3天前的预约记录 (截止日期: ${cutoffDate})`);
      return { deleted: result.count, cutoffDate };
    } else {
      console.log('ℹ️  没有需要清理的旧预约记录');
      return { deleted: 0, cutoffDate };
    }
  } catch (error) {
    console.error('❌ 清理旧预约记录失败:', error);
    throw error;
  }
};
