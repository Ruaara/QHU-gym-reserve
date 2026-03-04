import { Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dbPromise from '../database/init';
import { saveDatabase } from '../database/init';
import { AuthRequest } from '../middleware/auth';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置图片上传
const uploadsDir = path.join(__dirname, '../../uploads/announcements');

// 确保上传目录存在
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // 生成唯一文件名
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'announcement-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 限制5MB
  },
  fileFilter: (req, file, cb) => {
    // 只允许图片
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('只支持上传图片文件 (jpeg, jpg, png, gif, webp)'));
    }
  }
});

export const uploadAnnouncementImage = upload.single('image');

// 获取公告列表
export const getAnnouncements = async (req: AuthRequest, res: Response) => {
  try {
    const db = await dbPromise;

    const stmt = db.prepare(`
      SELECT id, title, description, content, image_url, link_url, order_index, is_active, created_at
      FROM announcements
      WHERE is_active = 1
      ORDER BY order_index, created_at
    `);

    const announcements: any[] = [];
    stmt.bind({});
    while (stmt.step()) {
      announcements.push(stmt.getAsObject());
    }

    res.json({
      announcements: announcements.map((a: any) => ({
        id: a.id,
        title: a.title,
        description: a.description,
        content: a.content,
        imageUrl: a.image_url,
        linkUrl: a.link_url,
        orderIndex: a.order_index,
        isActive: a.is_active === 1,
        createdAt: a.created_at
      }))
    });
  } catch (error) {
    console.error('获取公告列表错误:', error);
    res.status(500).json({ error: '获取公告列表失败' });
  }
};

// 管理员获取所有公告（包括停用的）
export const adminGetAnnouncements = async (req: AuthRequest, res: Response) => {
  try {
    const db = await dbPromise;

    const stmt = db.prepare(`
      SELECT id, title, description, content, image_url, link_url, order_index, is_active, created_at
      FROM announcements
      ORDER BY order_index, created_at
    `);

    const announcements: any[] = [];
    stmt.bind({});
    while (stmt.step()) {
      announcements.push(stmt.getAsObject());
    }

    res.json({
      announcements: announcements.map((a: any) => ({
        id: a.id,
        title: a.title,
        description: a.description,
        content: a.content,
        imageUrl: a.image_url,
        linkUrl: a.link_url,
        orderIndex: a.order_index,
        isActive: a.is_active === 1,
        createdAt: a.created_at
      }))
    });
  } catch (error) {
    console.error('获取公告列表错误:', error);
    res.status(500).json({ error: '获取公告列表失败' });
  }
};

// 上传图片并返回URL
export const uploadImage = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请选择要上传的图片' });
    }

    // 返回图片URL路径
    const imageUrl = `/uploads/announcements/${req.file.filename}`;

    res.json({
      message: '图片上传成功',
      imageUrl: imageUrl
    });
  } catch (error) {
    console.error('上传图片错误:', error);
    res.status(500).json({ error: '上传图片失败' });
  }
};

// 添加公告
export const addAnnouncement = async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, content, imageUrl, linkUrl, orderIndex } = req.body;

    if (!title || !imageUrl) {
      return res.status(400).json({ error: '请填写标题和图片' });
    }

    const db = await dbPromise;

    const insertStmt = db.prepare(`
      INSERT INTO announcements (title, description, content, image_url, link_url, order_index)
      VALUES (:title, :description, :content, :imageUrl, :linkUrl, :orderIndex)
    `);
    insertStmt.run({
      ':title': title,
      ':description': description || '',
      ':content': content || '',
      ':imageUrl': imageUrl,
      ':linkUrl': linkUrl || '',
      ':orderIndex': orderIndex || 0
    });

    saveDatabase();

    res.json({ message: '添加公告成功' });
  } catch (error) {
    console.error('添加公告错误:', error);
    res.status(500).json({ error: '添加公告失败' });
  }
};

// 修改公告
export const updateAnnouncement = async (req: AuthRequest, res: Response) => {
  try {
    const announcementId = req.params.id;
    const { title, description, content, imageUrl, linkUrl, orderIndex, isActive } = req.body;

    const db = await dbPromise;

    // 检查公告是否存在
    const checkStmt = db.prepare('SELECT id, image_url FROM announcements WHERE id = :id');
    const announcement = checkStmt.getAsObject({ ':id': announcementId }) as any;

    if (!announcement || !announcement.id) {
      return res.status(404).json({ error: '公告不存在' });
    }

    // 如果更换了图片，删除旧图片
    if (imageUrl && announcement.image_url !== imageUrl) {
      const oldImagePath = path.join(__dirname, '../../..', announcement.image_url);
      if (fs.existsSync(oldImagePath) && announcement.image_url.startsWith('/uploads/')) {
        fs.unlinkSync(oldImagePath);
      }
    }

    // 更新公告
    const updateStmt = db.prepare(`
      UPDATE announcements
      SET title = :title,
          description = :description,
          content = :content,
          image_url = :imageUrl,
          link_url = :linkUrl,
          order_index = :orderIndex,
          is_active = :isActive
      WHERE id = :id
    `);
    updateStmt.run({
      ':title': title,
      ':description': description || '',
      ':content': content || '',
      ':imageUrl': imageUrl,
      ':linkUrl': linkUrl || '',
      ':orderIndex': orderIndex !== undefined ? orderIndex : 0,
      ':isActive': isActive !== undefined ? (isActive ? 1 : 0) : 1,
      ':id': announcementId
    });

    saveDatabase();

    res.json({ message: '修改公告成功' });
  } catch (error) {
    console.error('修改公告错误:', error);
    res.status(500).json({ error: '修改公告失败' });
  }
};

// 删除公告
export const deleteAnnouncement = async (req: AuthRequest, res: Response) => {
  try {
    const announcementId = req.params.id;

    const db = await dbPromise;

    // 检查公告是否存在并获取图片路径
    const checkStmt = db.prepare('SELECT id, image_url FROM announcements WHERE id = :id');
    const announcement = checkStmt.getAsObject({ ':id': announcementId }) as any;

    if (!announcement || !announcement.id) {
      return res.status(404).json({ error: '公告不存在' });
    }

    // 删除图片文件
    if (announcement.image_url && announcement.image_url.startsWith('/uploads/')) {
      const imagePath = path.join(__dirname, '../../..', announcement.image_url);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    // 删除公告
    const deleteStmt = db.prepare('DELETE FROM announcements WHERE id = :id');
    deleteStmt.run({ ':id': announcementId });

    saveDatabase();

    res.json({ message: '删除公告成功' });
  } catch (error) {
    console.error('删除公告错误:', error);
    res.status(500).json({ error: '删除公告失败' });
  }
};
