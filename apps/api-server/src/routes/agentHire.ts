import { Router, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

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

router.get('/my-agents', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;

    const hires = await prisma.agentHire.findMany({
      where: {
        userId,
        isActive: true,
      },
      include: {
        agent: true,
      },
      orderBy: {
        hiredAt: 'desc',
      },
    });

    const agents = hires.map((hire) => ({
      ...hire.agent,
      hiredAt: hire.hiredAt.toISOString(),
    }));

    res.json({
      success: true,
      data: agents,
    });
  } catch (error) {
    console.error('Get my agents error:', error);
    res.status(500).json({ success: false, message: '获取已雇佣 Agent 失败' });
  }
});

router.post('/hire/:agentId', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const agentId = getSinglePathParam(req.params.agentId);

    if (!agentId) {
      res.status(400).json({ success: false, message: 'agentId 参数无效' });
      return;
    }

    const agent = await prisma.agent.findUnique({
      where: { agentId },
    });

    if (!agent) {
      res.status(404).json({ success: false, message: 'Agent 不存在' });
      return;
    }

    const existingHire = await prisma.agentHire.findUnique({
      where: {
        userId_agentId: {
          userId,
          agentId,
        },
      },
    });

    if (existingHire) {
      if (existingHire.isActive) {
        res.status(400).json({ success: false, message: '已经雇佣过此 Agent' });
        return;
      }

      await prisma.agentHire.update({
        where: { id: existingHire.id },
        data: {
          isActive: true,
          hiredAt: new Date(),
          canceledAt: null,
        },
      });
    } else {
      await prisma.agentHire.create({
        data: {
          userId,
          agentId,
        },
      });
    }

    res.json({
      success: true,
      message: '雇佣成功',
    });
  } catch (error) {
    console.error('Hire agent error:', error);
    res.status(500).json({ success: false, message: '雇佣失败' });
  }
});

router.delete('/hire/:agentId', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const agentId = getSinglePathParam(req.params.agentId);

    if (!agentId) {
      res.status(400).json({ success: false, message: 'agentId 参数无效' });
      return;
    }

    const hire = await prisma.agentHire.findUnique({
      where: {
        userId_agentId: {
          userId,
          agentId,
        },
      },
    });

    if (!hire || !hire.isActive) {
      res.status(404).json({ success: false, message: '未雇佣此 Agent' });
      return;
    }

    await prisma.agentHire.update({
      where: { id: hire.id },
      data: {
        isActive: false,
        canceledAt: new Date(),
      },
    });

    res.json({
      success: true,
      message: '已取消雇佣',
    });
  } catch (error) {
    console.error('Cancel hire error:', error);
    res.status(500).json({ success: false, message: '取消雇佣失败' });
  }
});

router.get('/status', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;

    const hires = await prisma.agentHire.findMany({
      where: {
        userId,
        isActive: true,
      },
      select: {
        agentId: true,
      },
    });

    const hiredAgentIds = hires.map((h) => h.agentId);

    res.json({
      success: true,
      data: hiredAgentIds,
    });
  } catch (error) {
    console.error('Get hire status error:', error);
    res.status(500).json({ success: false, message: '获取雇佣状态失败' });
  }
});

export default router;
