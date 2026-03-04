import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import dbPromise from '../database/init';
import { generateToken } from '../utils/jwt';
import { AuthRequest } from '../middleware/auth';

// 用户注册
export const register = async (req: Request, res: Response) => {
  try {
    const { name, account, password } = req.body;

    // 验证必填字段
    if (!name || !account || !password) {
      return res.status(400).json({ error: '请填写完整信息' });
    }

    const db = await dbPromise;

    // 检查账号是否已存在
    const stmt = db.prepare('SELECT id FROM users WHERE account = :account');
    const existingUser = stmt.getAsObject({ ':account': account }) as any;

    if (existingUser && existingUser.id) {
      return res.status(400).json({ error: '该账号已被注册' });
    }

    // 加密密码
    const hashedPassword = bcrypt.hashSync(password, 10);

    // 创建用户
    const insertStmt = db.prepare(`
      INSERT INTO users (name, account, password)
      VALUES (:name, :account, :password)
    `);
    insertStmt.run({
      ':name': name,
      ':account': account,
      ':password': hashedPassword
    });

    // 获取新创建的用户信息
    const userStmt = db.prepare('SELECT id, name, account, role, is_club, is_banned FROM users WHERE account = :account');
    const user = userStmt.getAsObject({ ':account': account }) as any;

    // 生成 token
    const token = generateToken({
      userId: user.id,
      account: user.account,
      role: user.role,
      isClub: user.is_club === 1
    });

    res.status(201).json({
      message: '注册成功',
      token,
      user: {
        id: user.id,
        name: user.name,
        account: user.account,
        role: user.role,
        isClub: user.is_club === 1
      }
    });
  } catch (error) {
    console.error('注册错误:', error);
    res.status(500).json({ error: '注册失败' });
  }
};

// 用户登录
export const login = async (req: Request, res: Response) => {
  try {
    const { account, password } = req.body;

    // 验证必填字段
    if (!account || !password) {
      return res.status(400).json({ error: '请填写账号和密码' });
    }

    const db = await dbPromise;

    // 查找用户
    const stmt = db.prepare('SELECT * FROM users WHERE account = :account');
    const user = stmt.getAsObject({ ':account': account }) as any;

    if (!user || !user.id) {
      return res.status(401).json({ error: '账号或密码错误' });
    }

    // 检查账号是否被封禁
    if (user.is_banned) {
      return res.status(403).json({ error: '该账号已被封禁' });
    }

    // 验证密码
    const isPasswordValid = bcrypt.compareSync(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: '账号或密码错误' });
    }

    // 生成 token
    const token = generateToken({
      userId: user.id,
      account: user.account,
      role: user.role,
      isClub: user.is_club === 1
    });

    res.json({
      message: '登录成功',
      token,
      user: {
        id: user.id,
        name: user.name,
        account: user.account,
        role: user.role,
        isClub: user.is_club === 1
      }
    });
  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({ error: '登录失败' });
  }
};

// 获取当前用户信息
export const getCurrentUser = async (req: AuthRequest, res: Response) => {
  try {
    const db = await dbPromise;

    const stmt = db.prepare(`
      SELECT id, name, account, role, is_club, is_banned
      FROM users
      WHERE id = :id
    `);
    const user = stmt.getAsObject({ ':id': req.user!.userId }) as any;

    if (!user || !user.id) {
      return res.status(404).json({ error: '用户不存在' });
    }

    res.json({
      id: user.id,
      name: user.name,
      account: user.account,
      role: user.role,
      isClub: user.is_club === 1,
      isBanned: user.is_banned === 1
    });
  } catch (error) {
    console.error('获取用户信息错误:', error);
    res.status(500).json({ error: '获取用户信息失败' });
  }
};
