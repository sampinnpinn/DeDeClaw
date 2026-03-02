import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const yesterdayStart = startOfDay(daysAgo(1));
    const yesterdayEnd = endOfDay(daysAgo(1));
    const lastWeekStart = startOfDay(daysAgo(7));
    const lastWeekEnd = endOfDay(daysAgo(1));

    const [
      totalUsers,
      todayUsers,
      yesterdayUsers,
      lastWeekUsers,
      totalGeneratedArticles,
      todayGeneratedArticles,
      yesterdayGeneratedArticles,
      lastWeekGeneratedArticles,
      totalCallsAgg,
      todayCallsAgg,
      yesterdayCallsAgg,
      lastWeekCallsAgg,
      totalSuccessCalls,
      todaySuccessCalls,
      callTypeBreakdown,
      topTokenUsers,
    ] = await Promise.all([
      // 用户总数
      prisma.user.count(),
      // 今日新增用户
      prisma.user.count({ where: { createdAt: { gte: todayStart, lte: todayEnd } } }),
      // 昨日新增用户
      prisma.user.count({ where: { createdAt: { gte: yesterdayStart, lte: yesterdayEnd } } }),
      // 上周新增用户（7天前~昨天）
      prisma.user.count({ where: { createdAt: { gte: lastWeekStart, lte: lastWeekEnd } } }),

      // 生成文章统计（按生成完成时间）
      prisma.asset.count({ where: { assetType: '文章', generationStatus: 'done' } }),
      prisma.asset.count({ where: { assetType: '文章', generationStatus: 'done', updatedAt: { gte: todayStart, lte: todayEnd } } }),
      prisma.asset.count({ where: { assetType: '文章', generationStatus: 'done', updatedAt: { gte: yesterdayStart, lte: yesterdayEnd } } }),
      prisma.asset.count({ where: { assetType: '文章', generationStatus: 'done', updatedAt: { gte: lastWeekStart, lte: lastWeekEnd } } }),

      // 总调用次数 + token
      prisma.apiCallLog.aggregate({ _count: { id: true }, _sum: { totalTokens: true } }),
      // 今日调用
      prisma.apiCallLog.aggregate({
        where: { createdAt: { gte: todayStart, lte: todayEnd } },
        _count: { id: true },
        _sum: { totalTokens: true },
      }),
      // 昨日调用
      prisma.apiCallLog.aggregate({
        where: { createdAt: { gte: yesterdayStart, lte: yesterdayEnd } },
        _count: { id: true },
        _sum: { totalTokens: true },
      }),
      // 上周调用
      prisma.apiCallLog.aggregate({
        where: { createdAt: { gte: lastWeekStart, lte: lastWeekEnd } },
        _count: { id: true },
        _sum: { totalTokens: true },
      }),

      // 总成功次数
      prisma.apiCallLog.count({ where: { isSuccess: true } }),
      // 今日成功次数
      prisma.apiCallLog.count({ where: { isSuccess: true, createdAt: { gte: todayStart, lte: todayEnd } } }),

      // 调用场景占比
      prisma.apiCallLog.groupBy({
        by: ['callType'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),

      // 用户 Token 消耗排名 Top 10
      prisma.apiCallLog.groupBy({
        by: ['userId', 'username', 'userEmail'],
        where: { userId: { not: null } },
        _sum: { totalTokens: true },
        orderBy: { _sum: { totalTokens: 'desc' } },
        take: 10,
      }),
    ]);

    const totalCalls = totalCallsAgg._count.id;
    const totalTokens = totalCallsAgg._sum.totalTokens ?? 0;
    const todayCalls = todayCallsAgg._count.id;
    const todayTokens = todayCallsAgg._sum.totalTokens ?? 0;
    const yesterdayCalls = yesterdayCallsAgg._count.id;
    const yesterdayTokens = yesterdayCallsAgg._sum.totalTokens ?? 0;
    const lastWeekCalls = lastWeekCallsAgg._count.id;
    const lastWeekTokens = lastWeekCallsAgg._sum.totalTokens ?? 0;

    const successRate = totalCalls > 0 ? totalSuccessCalls / totalCalls : 1;
    const todaySuccessRate = todayCalls > 0 ? todaySuccessCalls / todayCalls : 1;

    res.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          today: todayUsers,
          yesterday: yesterdayUsers,
          lastWeek: lastWeekUsers,
        },
        generatedArticles: {
          total: totalGeneratedArticles,
          today: todayGeneratedArticles,
          yesterday: yesterdayGeneratedArticles,
          lastWeek: lastWeekGeneratedArticles,
        },
        calls: {
          total: totalCalls,
          today: todayCalls,
          yesterday: yesterdayCalls,
          lastWeek: lastWeekCalls,
        },
        tokens: {
          total: totalTokens,
          today: todayTokens,
          yesterday: yesterdayTokens,
          lastWeek: lastWeekTokens,
        },
        successRate: {
          total: successRate,
          today: todaySuccessRate,
        },
        callTypeBreakdown: callTypeBreakdown.map((row) => ({
          callType: row.callType,
          count: row._count.id,
        })),
        topTokenUsers: topTokenUsers.map((row) => ({
          userId: row.userId ?? '',
          username: row.username ?? '',
          userEmail: row.userEmail ?? '',
          totalTokens: row._sum.totalTokens ?? 0,
        })),
      },
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ success: false, message: '获取看板数据失败' });
  }
});

export default router;
