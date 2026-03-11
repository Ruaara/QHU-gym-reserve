import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { getSystemSettings, updateSystemSettings } from '../controllers/systemSettingsController';

const router = Router();

// 所有路由都需要认证
router.use(authMiddleware);

// 获取系统设置
router.get('/', getSystemSettings);

// 更新系统设置（仅管理员）
router.put('/', updateSystemSettings);

export default router;
