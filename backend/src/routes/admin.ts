import express from 'express';
import multer from 'multer';
import {
  // 用户管理
  getUsers, addUser, banUser, importClubMembers, setUserRole, setUserClub,
  // 健身房管理
  getAdminGyms, addGym, updateGym, deleteGym, uploadGymImage, uploadGymImageHandler,
  // 时间段管理
  getAdminTimeSlots, addTimeSlot, updateTimeSlot, deleteTimeSlot,
  // 主管理员功能
  transferMainAdmin
} from '../controllers/adminController';
import { getBookingOpenTime, setBookingOpenTime } from '../controllers/settingsController';
import { authMiddleware, adminMiddleware, mainAdminMiddleware } from '../middleware/auth';

const router = express.Router();

// 所有管理员路由都需要认证
router.use(authMiddleware);

// 文件上传配置
const upload = multer({ dest: 'uploads/' });

// ========== 用户管理 ==========
// 获取用户列表（需要管理员权限）
router.get('/users', adminMiddleware, getUsers);

// 添加用户（需要管理员权限）
router.post('/users', adminMiddleware, addUser);

// 封禁/解封用户（需要管理员权限）
router.put('/users/:id/ban', adminMiddleware, banUser);

// 批量导入社团成员（需要管理员权限）
router.post('/users/import-club', adminMiddleware, upload.single('file'), importClubMembers);

// 设置用户角色（需要主管理员权限）
router.put('/users/:id/role', mainAdminMiddleware, setUserRole);

// 设置用户社团成员状态（需要管理员权限）
router.put('/users/:id/club', adminMiddleware, setUserClub);

// ========== 健身房管理 ==========
// 获取健身房管理列表（需要管理员权限）
router.get('/gyms', adminMiddleware, getAdminGyms);

// 上传健身房图片（需要管理员权限）
router.post('/gyms/upload-image', adminMiddleware, uploadGymImage, uploadGymImageHandler);

// 添加健身房（需要管理员权限）
router.post('/gyms', adminMiddleware, addGym);

// 修改健身房（需要管理员权限）
router.put('/gyms/:id', adminMiddleware, updateGym);

// 删除健身房（需要管理员权限）
router.delete('/gyms/:id', adminMiddleware, deleteGym);

// ========== 时间段管理 ==========
// 获取时间段管理列表（需要管理员权限）
router.get('/time-slots', adminMiddleware, getAdminTimeSlots);

// 添加时间段（需要管理员权限）
router.post('/time-slots', adminMiddleware, addTimeSlot);

// 修改时间段（需要管理员权限）
router.put('/time-slots/:id', adminMiddleware, updateTimeSlot);

// 删除时间段（需要管理员权限）
router.delete('/time-slots/:id', adminMiddleware, deleteTimeSlot);

// ========== 主管理员功能 ==========
// 转移主管理员权限（需要主管理员权限）
router.post('/transfer-main', mainAdminMiddleware, transferMainAdmin);

// ========== 系统设置 ==========
// 获取预约开放时间（需要管理员权限）
router.get('/booking-open-time', adminMiddleware, getBookingOpenTime);

// 设置预约开放时间（需要管理员权限）
router.put('/booking-open-time', adminMiddleware, setBookingOpenTime);

export default router;
