import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();

// GET /share/:token - 公开访问，无需鉴权
router.get('/:token', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params as { token: string };

    const asset = await prisma.asset.findUnique({
      where: { shareToken: token },
      select: {
        assetId: true,
        title: true,
        content: true,
        summary: true,
        tags: true,
        coverImage: true,
        createdAt: true,
        shareExpiresAt: true,
      },
    });

    if (!asset) {
      res.status(404).json({ success: false, message: '分享链接不存在或已失效' });
      return;
    }

    if (asset.shareExpiresAt && new Date() > asset.shareExpiresAt) {
      // 过期后清除 token
      await prisma.asset.update({
        where: { shareToken: token },
        data: { shareToken: null, shareExpiresAt: null },
      });
      res.status(410).json({ success: false, message: '分享链接已过期' });
      return;
    }

    res.json({
      success: true,
      data: {
        assetId: asset.assetId,
        title: asset.title,
        content: asset.content,
        summary: asset.summary,
        tags: asset.tags,
        coverImage: asset.coverImage,
        createdAt: asset.createdAt.toISOString(),
        shareExpiresAt: asset.shareExpiresAt?.toISOString() ?? null,
      },
    });
  } catch (err) {
    console.error('[Share] GET /:token error:', err);
    res.status(500).json({ success: false, message: '获取分享内容失败' });
  }
});

export default router;
