import express from 'express';
import {
  generateQrCodeImage,
  getMyQrCode,
  verifyQrCode
} from '../controllers/qrCodeController';
import { authMiddleware, adminMiddleware } from '../middleware/auth';

const router = express.Router();

// 获取我的二维码（今日预约）
router.get('/my-qrcode', authMiddleware, getMyQrCode);

// 生成指定预约的二维码图片
router.get('/generate/:reservationId', authMiddleware, generateQrCodeImage);

// 验证二维码（管理员扫一扫）
router.post('/verify', authMiddleware, adminMiddleware, verifyQrCode);

export default router;
