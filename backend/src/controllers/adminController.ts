import { Response } from 'express';
import bcrypt from 'bcryptjs';
import xlsx from 'xlsx';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import dbPromise from '../database/init';
import { saveDatabase } from '../database/init';
import { AuthRequest } from '../middleware/auth';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置健身房图片上传
const gymUploadsDir = path.join(__dirname, '../../uploads/gyms');
if (!fs.existsSync(gymUploadsDir)) {
  fs.mkdirSync(gymUploadsDir, { recursive: true });
}

const gymStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, gymUploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'gym-' + uniqueSuffix + ext);
  }
});

const gymUpload = multer({
  storage: gymStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('只支持上传图片文件'));
    }
  }
});

export const uploadGymImage = gymUpload.single('image');

// ========== 用户管理 ==========

// 获取用户列表
export const getUsers = async (req: AuthRequest, res: Response) => {
  try {
    const db = await dbPromise;

    const search = req.query.search as string;

    let query = `
      SELECT id, name, account, role, is_club, is_banned, created_at
      FROM users
      WHERE role != 'main_admin'
    `;

    const stmt = db.prepare(query);

    const users: any[] = [];
    stmt.bind({});
    while (stmt.step()) {
      users.push(stmt.getAsObject());
    }

    let filteredUsers = users;
    if (search) {
      filteredUsers = users.filter((u: any) =>
        u.name.includes(search) || u.account.includes(search)
      );
    }

    res.json({
      users: filteredUsers.map((u: any) => ({
        ...u,
        isClub: u.is_club === 1,
        isBanned: u.is_banned === 1
      }))
    });
  } catch (error) {
    console.error('获取用户列表错误:', error);
    res.status(500).json({ error: '获取用户列表失败' });
  }
};

// 添加用户
export const addUser = async (req: AuthRequest, res: Response) => {
  try {
    const { name, account, password, isClub } = req.body;

    if (!name || !account || !password) {
      return res.status(400).json({ error: '请填写完整信息' });
    }

    const db = await dbPromise;

    // 检查账号是否已存在
    const checkStmt = db.prepare('SELECT id FROM users WHERE account = :account');
    const existingUser = checkStmt.getAsObject({ ':account': account }) as any;

    if (existingUser && existingUser.id) {
      return res.status(400).json({ error: '该账号已存在' });
    }

    // 加密密码
    const hashedPassword = bcrypt.hashSync(password, 10);

    // 创建用户
    const insertStmt = db.prepare(`
      INSERT INTO users (name, account, password, is_club)
      VALUES (:name, :account, :password, :isClub)
    `);
    insertStmt.run({
      ':name': name,
      ':account': account,
      ':password': hashedPassword,
      ':isClub': isClub ? 1 : 0
    });

    saveDatabase();

    res.json({ message: '添加用户成功' });
  } catch (error) {
    console.error('添加用户错误:', error);
    res.status(500).json({ error: '添加用户失败' });
  }
};

// 封禁/解封用户
export const banUser = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.params.id;
    const { isBanned } = req.body;

    // 不能封禁自己
    if (parseInt(userId) === req.user!.userId) {
      return res.status(400).json({ error: '不能对自己进行此操作' });
    }

    const db = await dbPromise;

    // 检查用户是否存在
    const userStmt = db.prepare('SELECT * FROM users WHERE id = :id');
    const user = userStmt.getAsObject({ ':id': userId }) as any;

    if (!user || !user.id) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 不能封禁主管理员
    if (user.role === 'main_admin') {
      return res.status(403).json({ error: '不能封禁主管理员' });
    }

    // 更新封禁状态
    const updateStmt = db.prepare('UPDATE users SET is_banned = :isBanned WHERE id = :id');
    updateStmt.run({ ':isBanned': isBanned ? 1 : 0, ':id': userId });

    saveDatabase();

    res.json({ message: isBanned ? '封禁成功' : '解封成功' });
  } catch (error) {
    console.error('封禁用户错误:', error);
    res.status(500).json({ error: '操作失败' });
  }
};

// 批量导入社团成员
export const importClubMembers = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传Excel文件' });
    }

    // 读取Excel文件
    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet) as any[];

    let successCount = 0;
    let failedCount = 0;

    const db = await dbPromise;

    // 处理每一行数据
    for (const row of data) {
      // 假设Excel中只有学号列，列名为"学号"或"account"
      const account = row['学号'] || row['account'];

      if (account) {
        // 检查用户是否存在
        const userStmt = db.prepare('SELECT id FROM users WHERE account = :account');
        const user = userStmt.getAsObject({ ':account': account }) as any;

        if (user && user.id) {
          // 更新为社团成员
          const updateStmt = db.prepare('UPDATE users SET is_club = 1 WHERE id = :id');
          updateStmt.run({ ':id': user.id });
          successCount++;
        } else {
          failedCount++;
        }
      }
    }

    saveDatabase();

    // 删除上传的文件
    fs.unlinkSync(req.file.path);

    res.json({
      message: '导入完成',
      successCount,
      failedCount
    });
  } catch (error) {
    console.error('导入社团成员错误:', error);
    // 确保删除上传的文件
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: '导入失败' });
  }
};

// 设置用户角色（主管理员）
export const setUserRole = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.params.id;
    const { role } = req.body;

    if (role !== 'student' && role !== 'admin') {
      return res.status(400).json({ error: '无效的角色' });
    }

    // 不能修改自己的角色
    if (parseInt(userId) === req.user!.userId) {
      return res.status(400).json({ error: '不能修改自己的角色' });
    }

    const db = await dbPromise;

    // 检查用户是否存在
    const userStmt = db.prepare('SELECT * FROM users WHERE id = :id');
    const user = userStmt.getAsObject({ ':id': userId }) as any;

    if (!user || !user.id) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 不能修改主管理员的角色
    if (user.role === 'main_admin') {
      return res.status(403).json({ error: '不能修改主管理员' });
    }

    // 更新角色
    const updateStmt = db.prepare('UPDATE users SET role = :role WHERE id = :id');
    updateStmt.run({ ':role': role, ':id': userId });

    saveDatabase();

    res.json({ message: '设置角色成功' });
  } catch (error) {
    console.error('设置用户角色错误:', error);
    res.status(500).json({ error: '设置角色失败' });
  }
};

// 设置用户社团成员状态（管理员）
export const setUserClub = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.params.id;
    const { isClub } = req.body;

    const db = await dbPromise;

    // 检查用户是否存在
    const userStmt = db.prepare('SELECT * FROM users WHERE id = :id');
    const user = userStmt.getAsObject({ ':id': userId }) as any;

    if (!user || !user.id) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 更新社团成员状态
    const updateStmt = db.prepare('UPDATE users SET is_club = :isClub WHERE id = :id');
    updateStmt.run({ ':isClub': isClub ? 1 : 0, ':id': userId });

    saveDatabase();

    res.json({ message: isClub ? '设为社团成员成功' : '取消社团成员成功' });
  } catch (error) {
    console.error('设置社团成员错误:', error);
    res.status(500).json({ error: '设置社团成员失败' });
  }
};

// ========== 健身房管理 ==========

// 获取健身房管理列表
export const getAdminGyms = async (req: AuthRequest, res: Response) => {
  try {
    const db = await dbPromise;

    const stmt = db.prepare(`
      SELECT id, name, description, image_url, is_active, created_at
      FROM gyms
      ORDER BY id
    `);

    const gyms: any[] = [];
    stmt.bind({});
    while (stmt.step()) {
      gyms.push(stmt.getAsObject());
    }

    res.json({
      gyms: gyms.map((g: any) => ({
        id: g.id,
        name: g.name,
        description: g.description,
        imageUrl: g.image_url,
        isActive: g.is_active === 1,
        createdAt: g.created_at
      }))
    });
  } catch (error) {
    console.error('获取健身房列表错误:', error);
    res.status(500).json({ error: '获取健身房列表失败' });
  }
};

// 上传健身房图片
export const uploadGymImageHandler = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请选择要上传的图片' });
    }
    const imageUrl = `/uploads/gyms/${req.file.filename}`;
    res.json({ message: '图片上传成功', imageUrl });
  } catch (error) {
    console.error('上传图片错误:', error);
    res.status(500).json({ error: '上传图片失败' });
  }
};

// 添加健身房
export const addGym = async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, imageUrl } = req.body;

    if (!name) {
      return res.status(400).json({ error: '请填写健身房名称' });
    }

    const db = await dbPromise;

    const insertStmt = db.prepare(`
      INSERT INTO gyms (name, description, image_url)
      VALUES (:name, :description, :imageUrl)
    `);
    insertStmt.run({
      ':name': name,
      ':description': description || '',
      ':imageUrl': imageUrl || ''
    });

    saveDatabase();

    res.json({ message: '添加健身房成功' });
  } catch (error) {
    console.error('添加健身房错误:', error);
    res.status(500).json({ error: '添加健身房失败' });
  }
};

// 修改健身房
export const updateGym = async (req: AuthRequest, res: Response) => {
  try {
    const gymId = req.params.id;
    const { name, description, imageUrl, isActive } = req.body;

    const db = await dbPromise;

    // 检查健身房是否存在并获取旧图片
    const gymStmt = db.prepare('SELECT id, image_url FROM gyms WHERE id = :id');
    const gym = gymStmt.getAsObject({ ':id': gymId }) as any;

    if (!gym || !gym.id) {
      return res.status(404).json({ error: '健身房不存在' });
    }

    // 如果更换了图片，删除旧图片
    if (imageUrl && gym.image_url !== imageUrl) {
      const oldImagePath = path.join(__dirname, '../../..', gym.image_url);
      if (fs.existsSync(oldImagePath) && gym.image_url.startsWith('/uploads/')) {
        fs.unlinkSync(oldImagePath);
      }
    }

    // 更新健身房
    const updateStmt = db.prepare(`
      UPDATE gyms
      SET name = :name, description = :description, image_url = :imageUrl, is_active = :isActive
      WHERE id = :id
    `);
    updateStmt.run({
      ':name': name,
      ':description': description || '',
      ':imageUrl': imageUrl || '',
      ':isActive': isActive ? 1 : 0,
      ':id': gymId
    });

    saveDatabase();

    res.json({ message: '修改健身房成功' });
  } catch (error) {
    console.error('修改健身房错误:', error);
    res.status(500).json({ error: '修改健身房失败' });
  }
};

// 删除健身房
export const deleteGym = async (req: AuthRequest, res: Response) => {
  try {
    const gymId = req.params.id;

    const db = await dbPromise;

    // 检查健身房是否存在并获取图片
    const gymStmt = db.prepare('SELECT id, image_url FROM gyms WHERE id = :id');
    const gym = gymStmt.getAsObject({ ':id': gymId }) as any;

    if (!gym || !gym.id) {
      return res.status(404).json({ error: '健身房不存在' });
    }

    // 检查是否有关联的时间段
    const countStmt = db.prepare('SELECT COUNT(*) as count FROM time_slots WHERE gym_id = :gymId');
    const result = countStmt.getAsObject({ ':gymId': gymId }) as { count: number };

    if (result.count > 0) {
      return res.status(400).json({ error: '请先删除该健身房的所有时间段' });
    }

    // 删除图片文件
    if (gym.image_url && gym.image_url.startsWith('/uploads/')) {
      const imagePath = path.join(__dirname, '../../..', gym.image_url);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    // 删除健身房
    const deleteStmt = db.prepare('DELETE FROM gyms WHERE id = :id');
    deleteStmt.run({ ':id': gymId });

    saveDatabase();

    res.json({ message: '删除健身房成功' });
  } catch (error) {
    console.error('删除健身房错误:', error);
    res.status(500).json({ error: '删除健身房失败' });
  }
};

// ========== 时间段管理 ==========

// 获取时间段管理列表
export const getAdminTimeSlots = async (req: AuthRequest, res: Response) => {
  try {
    const db = await dbPromise;

    const stmt = db.prepare(`
      SELECT ts.id, ts.gym_id, ts.start_time, ts.end_time,
             ts.is_club_only, ts.max_capacity, ts.is_active,
             ts.days_available, ts.booking_open_time,
             g.name as gym_name
      FROM time_slots ts
      JOIN gyms g ON ts.gym_id = g.id
      ORDER BY g.name, ts.start_time
    `);

    const timeSlots: any[] = [];
    stmt.bind({});
    while (stmt.step()) {
      timeSlots.push(stmt.getAsObject());
    }

    res.json({
      timeSlots: timeSlots.map((ts: any) => ({
        id: ts.id,
        gymId: ts.gym_id,
        gymName: ts.gym_name,
        startTime: ts.start_time,
        endTime: ts.end_time,
        maxCapacity: ts.max_capacity,
        isClubOnly: ts.is_club_only === 1,
        isActive: ts.is_active === 1,
        daysAvailable: ts.days_available ? ts.days_available.split(',').map(Number) : [1,2,3,4,5,6,7],
        bookingOpenTime: ts.booking_open_time || '20:00'
      }))
    });
  } catch (error) {
    console.error('获取时间段列表错误:', error);
    res.status(500).json({ error: '获取时间段列表失败' });
  }
};

// 添加时间段
export const addTimeSlot = async (req: AuthRequest, res: Response) => {
  try {
    const { gymId, startTime, endTime, isClubOnly, maxCapacity, daysAvailable, bookingOpenTime } = req.body;

    if (!gymId || !startTime || !endTime || !maxCapacity) {
      return res.status(400).json({ error: '请填写完整信息' });
    }

    const db = await dbPromise;

    // 检查健身房是否存在
    const gymStmt = db.prepare('SELECT id FROM gyms WHERE id = :id');
    const gym = gymStmt.getAsObject({ ':id': gymId }) as any;

    if (!gym || !gym.id) {
      return res.status(404).json({ error: '健身房不存在' });
    }

    // 处理星期几数据
    const daysStr = Array.isArray(daysAvailable) ? daysAvailable.join(',') : (daysAvailable || '1,2,3,4,5,6,7');

    // 添加时间段
    const insertStmt = db.prepare(`
      INSERT INTO time_slots (gym_id, start_time, end_time, is_club_only, max_capacity, days_available, booking_open_time)
      VALUES (:gymId, :startTime, :endTime, :isClubOnly, :maxCapacity, :daysAvailable, :bookingOpenTime)
    `);
    insertStmt.run({
      ':gymId': gymId,
      ':startTime': startTime,
      ':endTime': endTime,
      ':isClubOnly': isClubOnly ? 1 : 0,
      ':maxCapacity': maxCapacity,
      ':daysAvailable': daysStr,
      ':bookingOpenTime': bookingOpenTime || '20:00'
    });

    saveDatabase();

    res.json({ message: '添加时间段成功' });
  } catch (error) {
    console.error('添加时间段错误:', error);
    res.status(500).json({ error: '添加时间段失败' });
  }
};

// 修改时间段
export const updateTimeSlot = async (req: AuthRequest, res: Response) => {
  try {
    const slotId = req.params.id;
    const { startTime, endTime, isClubOnly, maxCapacity, isActive, daysAvailable, bookingOpenTime } = req.body;

    const db = await dbPromise;

    // 检查时间段是否存在
    const slotStmt = db.prepare('SELECT id FROM time_slots WHERE id = :id');
    const slot = slotStmt.getAsObject({ ':id': slotId }) as any;

    if (!slot || !slot.id) {
      return res.status(404).json({ error: '时间段不存在' });
    }

    // 处理星期几数据
    const daysStr = Array.isArray(daysAvailable) ? daysAvailable.join(',') : (daysAvailable || '1,2,3,4,5,6,7');

    // 更新时间段
    const updateStmt = db.prepare(`
      UPDATE time_slots
      SET start_time = :startTime, end_time = :endTime,
          is_club_only = :isClubOnly, max_capacity = :maxCapacity, is_active = :isActive,
          days_available = :daysAvailable, booking_open_time = :bookingOpenTime
      WHERE id = :id
    `);
    updateStmt.run({
      ':startTime': startTime,
      ':endTime': endTime,
      ':isClubOnly': isClubOnly ? 1 : 0,
      ':maxCapacity': maxCapacity,
      ':isActive': isActive ? 1 : 0,
      ':daysAvailable': daysStr,
      ':bookingOpenTime': bookingOpenTime || '20:00',
      ':id': slotId
    });

    saveDatabase();

    res.json({ message: '修改时间段成功' });
  } catch (error) {
    console.error('修改时间段错误:', error);
    res.status(500).json({ error: '修改时间段失败' });
  }
};

// 删除时间段
export const deleteTimeSlot = async (req: AuthRequest, res: Response) => {
  try {
    const slotId = req.params.id;

    const db = await dbPromise;

    // 检查时间段是否存在
    const slotStmt = db.prepare('SELECT id FROM time_slots WHERE id = :id');
    const slot = slotStmt.getAsObject({ ':id': slotId }) as any;

    if (!slot || !slot.id) {
      return res.status(404).json({ error: '时间段不存在' });
    }

    // 检查是否有关联的预约
    const countStmt = db.prepare('SELECT COUNT(*) as count FROM reservations WHERE time_slot_id = :slotId');
    const result = countStmt.getAsObject({ ':slotId': slotId }) as { count: number };

    if (result.count > 0) {
      return res.status(400).json({ error: '该时间段已有预约记录，无法删除' });
    }

    // 删除时间段
    const deleteStmt = db.prepare('DELETE FROM time_slots WHERE id = :id');
    deleteStmt.run({ ':id': slotId });

    saveDatabase();

    res.json({ message: '删除时间段成功' });
  } catch (error) {
    console.error('删除时间段错误:', error);
    res.status(500).json({ error: '删除时间段失败' });
  }
};

// ========== 主管理员功能 ==========

// 转移主管理员权限
export const transferMainAdmin = async (req: AuthRequest, res: Response) => {
  try {
    const { account, password } = req.body;

    if (!account || !password) {
      return res.status(400).json({ error: '请填写账号和密码' });
    }

    const currentUserId = req.user!.userId;
    const db = await dbPromise;

    // 验证当前用户密码
    const currentUserStmt = db.prepare('SELECT * FROM users WHERE id = :id');
    const currentUser = currentUserStmt.getAsObject({ ':id': currentUserId }) as any;
    const isPasswordValid = bcrypt.compareSync(password, currentUser.password);

    if (!isPasswordValid) {
      return res.status(401).json({ error: '密码错误' });
    }

    // 检查目标用户是否存在
    const targetUserStmt = db.prepare('SELECT * FROM users WHERE account = :account');
    const targetUser = targetUserStmt.getAsObject({ ':account': account }) as any;

    if (!targetUser || !targetUser.id) {
      return res.status(404).json({ error: '目标用户不存在' });
    }

    // 不能转移给自己
    if (targetUser.id === currentUserId) {
      return res.status(400).json({ error: '不能转移给自己' });
    }

    // 将当前用户改为普通管理员
    const updateCurrentStmt = db.prepare('UPDATE users SET role = :role WHERE id = :id');
    updateCurrentStmt.run({ ':role': 'admin', ':id': currentUserId });

    // 将目标用户设为主管理员
    const updateTargetStmt = db.prepare('UPDATE users SET role = :role WHERE id = :id');
    updateTargetStmt.run({ ':role': 'main_admin', ':id': targetUser.id });

    saveDatabase();

    res.json({ message: '转移主管理员权限成功' });
  } catch (error) {
    console.error('转移主管理员权限错误:', error);
    res.status(500).json({ error: '转移主管理员权限失败' });
  }
};
