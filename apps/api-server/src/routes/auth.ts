import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import {
  hashPassword,
  verifyPassword,
  generateUserId,
  generateWorkspaceId,
  generateInvitationCode,
} from '../utils/auth.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

const registerSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  password: z.string().min(6, '密码至少需要6个字符'),
  username: z.string().min(1, '用户名不能为空'),
  workspaceType: z.enum(['creator', 'member']),
  invitationCode: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  password: z.string().min(1, '密码不能为空'),
});

router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = registerSchema.parse(req.body);
    const { email, password, username, workspaceType, invitationCode } = validatedData;

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      res.status(400).json({ success: false, message: '该邮箱已被注册' });
      return;
    }

    if (workspaceType === 'member' && !invitationCode) {
      res.status(400).json({ success: false, message: '加入空间需要提供邀请码' });
      return;
    }

    let workspace;
    let workspaceMemberRole = 'member';

    if (workspaceType === 'member') {
      workspace = await prisma.workspace.findUnique({
        where: { invitationCode: invitationCode! },
      });

      if (!workspace) {
        res.status(400).json({ success: false, message: '无效的邀请码' });
        return;
      }
    }

    const userId = generateUserId();
    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        userId,
        email,
        passwordHash,
        username,
      },
    });

    if (workspaceType === 'creator') {
      const workspaceId = generateWorkspaceId();
      const invCode = generateInvitationCode();

      workspace = await prisma.workspace.create({
        data: {
          workspaceId,
          name: `${username}的空间`,
          type: 'creator',
          ownerId: userId,
          invitationCode: invCode,
        },
      });

      workspaceMemberRole = 'owner';
    }

    await prisma.workspaceMember.create({
      data: {
        workspaceId: workspace!.workspaceId,
        userId: user.userId,
        role: workspaceMemberRole,
      },
    });

    const token = user.id;

    const userResponse = {
      id: user.id,
      userId: user.userId,
      email: user.email,
      username: user.username,
      avatar: user.avatar,
      signature: user.signature,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };

    const workspaceResponse = {
      id: workspace!.id,
      workspaceId: workspace!.workspaceId,
      name: workspace!.name,
      type: workspace!.type,
      ownerId: workspace!.ownerId,
      invitationCode: workspace!.invitationCode,
      createdAt: workspace!.createdAt.toISOString(),
      updatedAt: workspace!.updatedAt.toISOString(),
    };

    res.status(201).json({
      success: true,
      message: '注册成功',
      data: {
        user: userResponse,
        workspace: workspaceResponse,
        token,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        message: error.issues[0].message,
      });
      return;
    }
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: '注册失败，请稍后重试' });
  }
});

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = loginSchema.parse(req.body);
    const { email, password } = validatedData;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      res.status(401).json({ success: false, message: '邮箱或密码错误' });
      return;
    }

    const isPasswordValid = await verifyPassword(password, user.passwordHash);

    if (!isPasswordValid) {
      res.status(401).json({ success: false, message: '邮箱或密码错误' });
      return;
    }

    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { userId: user.userId },
      include: { workspace: true },
    });

    if (!workspaceMember) {
      res.status(500).json({ success: false, message: '用户工作空间数据异常' });
      return;
    }

    const token = user.id;

    const userResponse = {
      id: user.id,
      userId: user.userId,
      email: user.email,
      username: user.username,
      avatar: user.avatar,
      signature: user.signature,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };

    const workspaceResponse = {
      id: workspaceMember.workspace.id,
      workspaceId: workspaceMember.workspace.workspaceId,
      name: workspaceMember.workspace.name,
      type: workspaceMember.workspace.type,
      ownerId: workspaceMember.workspace.ownerId,
      invitationCode: workspaceMember.workspace.invitationCode,
      createdAt: workspaceMember.workspace.createdAt.toISOString(),
      updatedAt: workspaceMember.workspace.updatedAt.toISOString(),
    };

    res.json({
      success: true,
      message: '登录成功',
      data: {
        user: userResponse,
        workspace: workspaceResponse,
        token,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        message: error.issues[0].message,
      });
      return;
    }
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: '登录失败，请稍后重试' });
  }
});

const updateProfileSchema = z.object({
  username: z.string().min(1, '用户名不能为空').optional(),
  signature: z.string().max(200, '个性签名最多200字').optional(),
  avatar: z.string().optional(),
});

router.patch('/profile', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const validatedData = updateProfileSchema.parse(req.body);
    const { username, signature, avatar } = validatedData;

    const updateData: { username?: string; signature?: string; avatar?: string } = {};
    if (username !== undefined) updateData.username = username;
    if (signature !== undefined) updateData.signature = signature;
    if (avatar !== undefined) updateData.avatar = avatar;

    if (Object.keys(updateData).length === 0) {
      res.status(400).json({ success: false, message: '没有需要更新的字段' });
      return;
    }

    const user = await prisma.user.update({
      where: { userId: req.userId },
      data: updateData,
    });

    const userResponse = {
      id: user.id,
      userId: user.userId,
      email: user.email,
      username: user.username,
      avatar: user.avatar,
      signature: user.signature,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };

    res.json({ success: true, message: '资料更新成功', data: { user: userResponse } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, message: error.issues[0].message });
      return;
    }
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, message: '更新失败，请稍后重试' });
  }
});

router.get('/verify', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { userId: req.userId },
    });

    if (!user) {
      res.status(401).json({ success: false, message: '用户不存在' });
      return;
    }

    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { userId: user.userId },
      include: { workspace: true },
    });

    if (!workspaceMember) {
      res.status(500).json({ success: false, message: '用户工作空间数据异常' });
      return;
    }

    const userResponse = {
      id: user.id,
      userId: user.userId,
      email: user.email,
      username: user.username,
      avatar: user.avatar,
      signature: user.signature,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };

    const workspaceResponse = {
      id: workspaceMember.workspace.id,
      workspaceId: workspaceMember.workspace.workspaceId,
      name: workspaceMember.workspace.name,
      type: workspaceMember.workspace.type,
      ownerId: workspaceMember.workspace.ownerId,
      invitationCode: workspaceMember.workspace.invitationCode,
      createdAt: workspaceMember.workspace.createdAt.toISOString(),
      updatedAt: workspaceMember.workspace.updatedAt.toISOString(),
    };

    res.json({
      success: true,
      data: {
        user: userResponse,
        workspace: workspaceResponse,
      },
    });
  } catch (error) {
    console.error('Verify error:', error);
    res.status(500).json({ success: false, message: '验证失败' });
  }
});

export default router;
