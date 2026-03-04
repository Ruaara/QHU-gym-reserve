import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';

export interface AuthRequest extends Request {
  user?: {
    userId: number;
    account: string;
    role: string;
    isClub: boolean;
  };
}

// 认证中间件
export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未提供认证令牌' });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: '无效的认证令牌' });
  }
};

// 管理员权限中间件
export const adminMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'admin' && req.user?.role !== 'main_admin') {
    return res.status(403).json({ error: '需要管理员权限' });
  }
  next();
};

// 主管理员权限中间件
export const mainAdminMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'main_admin') {
    return res.status(403).json({ error: '需要主管理员权限' });
  }
  next();
};
