import express from 'express';
import { getTimeSlots } from '../controllers/timeSlotController';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

// 获取时间段列表（需要认证）
router.get('/', authMiddleware, getTimeSlots);

export default router;
