import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();

function getSinglePathParam(param: string | string[] | undefined): string | null {
  if (typeof param === 'string' && param.trim()) {
    return param;
  }
  if (Array.isArray(param) && typeof param[0] === 'string' && param[0].trim()) {
    return param[0];
  }
  return null;
}

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        userId: true,
        email: true,
        username: true,
        avatar: true,
        signature: true,
        createdAt: true,
        updatedAt: true,
        workspaceMembers: {
          include: {
            workspace: {
              select: {
                workspaceId: true,
                name: true,
                type: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const formattedUsers = users.map((user) => ({
      id: user.id,
      userId: user.userId,
      email: user.email,
      username: user.username,
      avatar: user.avatar,
      signature: user.signature,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      workspaces: user.workspaceMembers.map((member) => ({
        workspaceId: member.workspace.workspaceId,
        name: member.workspace.name,
        type: member.workspace.type,
        role: member.role,
      })),
    }));

    res.json({
      success: true,
      data: formattedUsers,
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ success: false, message: '获取用户列表失败' });
  }
});

router.delete('/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getSinglePathParam(req.params.userId);

    if (!userId) {
      res.status(400).json({ success: false, message: 'userId 参数无效' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { userId },
    });

    if (!user) {
      res.status(404).json({ success: false, message: '用户不存在' });
      return;
    }

    await prisma.user.delete({
      where: { userId },
    });

    res.json({
      success: true,
      message: '用户已删除',
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ success: false, message: '删除用户失败' });
  }
});

export default router;
