import express from 'express';
import {
  createReservation,
  getMyReservations,
  cancelReservation
} from '../controllers/reservationController';
import { getUserReservationLimit } from '../controllers/reservationLimitController';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

// 所有预约路由都需要认证
router.use(authMiddleware);

// 创建预约
router.post('/', createReservation);

// 获取我的预约
router.get('/my', getMyReservations);

// 获取用户预约限制状态
router.get('/limit-status', getUserReservationLimit);

// 取消预约
router.delete('/:id', cancelReservation);

export default router;
