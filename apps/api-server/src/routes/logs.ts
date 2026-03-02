import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
    const skip = (page - 1) * pageSize;

    const callType = req.query.callType as string | undefined;
    const apiType = req.query.apiType as string | undefined;
    const userId = req.query.userId as string | undefined;
    const modelCustomId = req.query.modelCustomId as string | undefined;

    const where: Record<string, unknown> = {};
    if (callType) where.callType = callType;
    if (apiType) where.apiType = apiType;
    if (userId) where.userId = userId;
    if (modelCustomId) where.modelCustomId = modelCustomId;

    const [total, list] = await Promise.all([
      prisma.apiCallLog.count({ where }),
      prisma.apiCallLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);

    res.json({
      success: true,
      data: {
        list: list.map((log) => ({
          id: log.id,
          modelCustomId: log.modelCustomId,
          apiType: log.apiType,
          callType: log.callType,
          userId: log.userId,
          userEmail: log.userEmail,
          username: log.username,
          channelId: log.channelId,
          promptTokens: log.promptTokens,
          completionTokens: log.completionTokens,
          totalTokens: log.totalTokens,
          durationMs: log.durationMs,
          isSuccess: log.isSuccess,
          errorMessage: log.errorMessage,
          createdAt: log.createdAt.toISOString(),
        })),
        total,
        page,
        pageSize,
      },
    });
  } catch (error) {
    console.error('Get logs error:', error);
    res.status(500).json({ success: false, message: '获取日志失败' });
  }
});

export default router;
