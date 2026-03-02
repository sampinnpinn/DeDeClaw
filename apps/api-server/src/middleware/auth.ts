import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';

export interface AuthRequest extends Request {
  userId?: string;
  user?: {
    id: string;
    userId: string;
    email: string;
    username: string;
  };
}

export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, message: '未提供认证令牌' });
      return;
    }

    const token = authHeader.substring(7);

    const user = await prisma.user.findFirst({
      where: { id: token },
      select: {
        id: true,
        userId: true,
        email: true,
        username: true,
      },
    });

    if (!user) {
      res.status(401).json({ success: false, message: '无效的认证令牌' });
      return;
    }

    req.userId = user.userId;
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ success: false, message: '认证失败' });
  }
}
