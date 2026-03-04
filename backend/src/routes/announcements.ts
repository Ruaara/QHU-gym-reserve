import express from 'express';
import {
  getAnnouncements,
  adminGetAnnouncements,
  uploadAnnouncementImage,
  uploadImage,
  addAnnouncement,
  updateAnnouncement,
  deleteAnnouncement
} from '../controllers/announcementController';
import { authMiddleware, adminMiddleware } from '../middleware/auth';

const router = express.Router();

// 获取公告列表（公开）
router.get('/', getAnnouncements);

// 管理员路由
// 获取所有公告（需要管理员权限）
router.get('/admin', authMiddleware, adminMiddleware, adminGetAnnouncements);

// 上传图片（需要管理员权限）
router.post('/admin/upload-image', authMiddleware, adminMiddleware, uploadAnnouncementImage, uploadImage);

// 添加公告（需要管理员权限）
router.post('/admin', authMiddleware, adminMiddleware, addAnnouncement);

// 修改公告（需要管理员权限）
router.put('/admin/:id', authMiddleware, adminMiddleware, updateAnnouncement);

// 删除公告（需要管理员权限）
router.delete('/admin/:id', authMiddleware, adminMiddleware, deleteAnnouncement);

export default router;
