import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cron from 'node-cron';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth';
import gymRoutes from './routes/gyms';
import timeSlotRoutes from './routes/timeSlots';
import reservationRoutes from './routes/reservations';
import adminRoutes from './routes/admin';
import announcementRoutes from './routes/announcements';
import { initDatabase } from './database/init';
import { cleanOldReservations } from './utils/cleanup';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件服务 - 用于提供上传的图片
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// 路由
app.use('/api/auth', authRoutes);
app.use('/api/gyms', gymRoutes);
app.use('/api/time-slots', timeSlotRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/announcements', announcementRoutes);

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'QHU Gym Reserve API is running' });
});

// 启动服务器
app.listen(PORT, async () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  console.log(`📚 Health check: http://localhost:${PORT}/health`);

  // 设置定时清理任务 - 每天凌晨2点执行
  cron.schedule('0 2 * * *', async () => {
    console.log('🧹 开始执行预约记录清理任务...');
    try {
      const result = await cleanOldReservations();
      console.log(`✅ 预约记录清理完成: 删除了 ${result.deleted} 条记录`);
    } catch (error) {
      console.error('❌ 预约记录清理失败:', error);
    }
  });

  console.log('⏰ 定时清理任务已设置: 每天凌晨2点执行');

  // 启动时执行一次清理
  console.log('🧹 执行启动时的预约记录清理...');
  try {
    const result = await cleanOldReservations();
    console.log(`✅ 启动时清理完成: 删除了 ${result.deleted} 条记录`);
  } catch (error) {
    console.error('❌ 启动时清理失败:', error);
  }
});

export default app;
