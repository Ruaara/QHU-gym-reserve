import express from 'express';
import { register, login, getCurrentUser, changePassword } from '../controllers/authController';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

// 用户注册
router.post('/register', register);

// 用户登录
router.post('/login', login);

// 获取当前用户信息
router.get('/me', authMiddleware, getCurrentUser);

// 修改密码
router.post('/change-password', authMiddleware, changePassword);

export default router;
