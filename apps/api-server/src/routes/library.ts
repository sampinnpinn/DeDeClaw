import { Router, Response } from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import { nanoid } from 'nanoid';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { embedFile, extractTextFromFile } from '../lib/embedding.js';
import type { EmbedCallContext } from '../lib/embedding.js';
import sharp from 'sharp';

const router = Router();

const STORAGE_PATH = path.resolve(process.cwd(), process.env.LIBRARY_STORAGE_PATH ?? 'library_files');
fs.mkdirSync(STORAGE_PATH, { recursive: true });

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'text/markdown',
  'text/x-markdown',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.md', '.doc', '.docx', '.xls', '.xlsx',
  '.jpg', '.jpeg', '.png', '.gif', '.webp',
]);

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const authReq = req as AuthRequest;
    const workspaceId = authReq.body?.workspaceId ?? 'default';
    const dir = path.join(STORAGE_PATH, workspaceId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const ext = path.extname(originalName).toLowerCase();
    cb(null, `${nanoid(16)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_MIME_TYPES.has(file.mimetype) || ALLOWED_EXTENSIONS.has(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`不支持的文件类型: ${file.originalname}`));
    }
  },
});

function detectFileType(mimeType: string, originalName: string): string {
  const ext = path.extname(originalName).toLowerCase();
  if (mimeType === 'application/pdf' || ext === '.pdf') return 'pdf';
  if (mimeType === 'text/markdown' || mimeType === 'text/x-markdown' || ext === '.md') return 'md';
  if (mimeType === 'application/msword' || ext === '.doc') return 'doc';
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || ext === '.docx') return 'docx';
  if (mimeType === 'application/vnd.ms-excel' || ext === '.xls') return 'excel';
  if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || ext === '.xlsx') return 'excel';
  if (mimeType.startsWith('image/')) return 'image';
  return 'unknown';
}

async function getUserWorkspaceId(userId: string): Promise<string | null> {
  const member = await prisma.workspaceMember.findFirst({
    where: { userId },
    include: { workspace: true },
  });
  return member?.workspace.workspaceId ?? null;
}

async function generateSummaryWithLLM(text: string, fileName: string): Promise<string> {
  const config = await prisma.modelProviderConfig.findFirst({
    where: { apiType: 'llm', isEnabled: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!config) return '';

  const { decrypt } = await import('../lib/crypto.js');
  const apiKey = decrypt(config.apiKey);
  const baseUrl = config.baseUrl.replace(/\/$/, '');

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: config.modelName,
      messages: [
        {
          role: 'user',
          content: `请用2-3句话简洁总结以下文档的核心内容，不要使用标题或列表，直接输出纯文本摘要：\n\n文件名：${fileName}\n\n${text.slice(0, 3000)}`,
        },
      ],
      max_tokens: 200,
    }),
  });

  if (!response.ok) return '';
  const data = (await response.json()) as { choices: Array<{ message: { content: string } }> };
  return data.choices[0]?.message?.content?.trim() ?? '';
}

async function runEmbedding(
  fileId: string,
  filePath: string,
  fileType: string,
  logCtx?: EmbedCallContext,
): Promise<void> {
  try {
    await prisma.libraryFile.update({
      where: { fileId },
      data: { embedStatus: 'processing' },
    });

    const chunks = await embedFile(filePath, fileType, logCtx);

    if (chunks.length === 0) {
      await prisma.libraryFile.update({
        where: { fileId },
        data: { embedStatus: 'done', chunkCount: 0 },
      });
      return;
    }

    await prisma.libraryChunk.deleteMany({ where: { fileId } });

    for (let i = 0; i < chunks.length; i++) {
      const { content, embedding } = chunks[i];
      const vectorLiteral = `[${embedding.join(',')}]`;
      await prisma.$executeRaw`
        INSERT INTO library_chunks (id, "fileId", "chunkIdx", content, embedding)
        VALUES (${nanoid()}, ${fileId}, ${i}, ${content}, ${vectorLiteral}::vector)
      `;
    }

    let summary: string | undefined;
    if (fileType !== 'image') {
      try {
        const { extractTextFromFile } = await import('../lib/embedding.js');
        const rawText = await extractTextFromFile(filePath, fileType);
        if (rawText.trim()) {
          summary = await generateSummaryWithLLM(rawText, fileId);
        }
      } catch { summary = undefined; }
    }

    await prisma.libraryFile.update({
      where: { fileId },
      data: { embedStatus: 'done', chunkCount: chunks.length, ...(summary ? { summary } : {}) },
    });

    console.log(`[Library] Embedded ${chunks.length} chunks for file ${fileId}`);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[Library] Embedding failed for ${fileId}:`, errMsg);
    await prisma.libraryFile.update({
      where: { fileId },
      data: { embedStatus: 'failed', embedError: errMsg },
    });
  }
}

router.get('/tags', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const workspaceId = await getUserWorkspaceId(userId);
    if (!workspaceId) { res.status(404).json({ success: false, message: '未找到工作空间' }); return; }

    const files = await prisma.libraryFile.findMany({
      where: { workspaceId },
      select: { tags: true },
    });
    const tagSet = new Set<string>();
    files.forEach((f) => f.tags.forEach((t) => tagSet.add(t)));
    res.json({ success: true, data: Array.from(tagSet) });
  } catch (err) {
    console.error('[Library] GET /tags error:', err);
    res.status(500).json({ success: false, message: '获取标签失败' });
  }
});

router.post('/tags', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { tag } = req.body as { tag: string };
    if (!tag?.trim()) { res.status(400).json({ success: false, message: '标签名不能为空' }); return; }

    const workspaceId = await getUserWorkspaceId(userId);
    if (!workspaceId) { res.status(404).json({ success: false, message: '未找到工作空间' }); return; }

    res.json({ success: true, data: { tag: tag.trim() } });
  } catch (err) {
    console.error('[Library] POST /tags error:', err);
    res.status(500).json({ success: false, message: '创建标签失败' });
  }
});

router.delete('/tags/:tag', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const tag = decodeURIComponent(req.params.tag as string);
    const workspaceId = await getUserWorkspaceId(userId);
    if (!workspaceId) { res.status(404).json({ success: false, message: '未找到工作空间' }); return; }

    const files = await prisma.libraryFile.findMany({
      where: { workspaceId, tags: { has: tag } },
      select: { fileId: true, tags: true },
    });

    await Promise.all(files.map((f) =>
      prisma.libraryFile.update({
        where: { fileId: f.fileId },
        data: { tags: f.tags.filter((t) => t !== tag) },
      })
    ));

    res.json({ success: true, data: { deleted: tag } });
  } catch (err) {
    console.error('[Library] DELETE /tags/:tag error:', err);
    res.status(500).json({ success: false, message: '删除标签失败' });
  }
});

router.get('/files', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const scope = (req.query.scope as string) ?? 'personal';
    const workspaceId = await getUserWorkspaceId(userId);
    if (!workspaceId) {
      res.status(404).json({ success: false, message: '未找到工作空间' });
      return;
    }

    const where = scope === 'shared'
      ? { workspaceId }
      : { workspaceId, uploadedBy: userId };

    const files = await prisma.libraryFile.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        fileId: true,
        fileName: true,
        fileType: true,
        fileSize: true,
        mimeType: true,
        tags: true,
        embedStatus: true,
        embedError: true,
        chunkCount: true,
        uploadedBy: true,
        filePath: true,
        summary: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const uploaderIds = [...new Set(files.map((f) => f.uploadedBy))];
    const users = await prisma.user.findMany({
      where: { userId: { in: uploaderIds } },
      select: { userId: true, username: true },
    });
    const userMap = new Map(users.map((u) => [u.userId, u.username]));

    const previews = await Promise.all(files.map(async (f) => {
      let thumbnailBase64: string | null = null;
      let textSnippet: string | null = null;

      if (scope === 'personal' && fs.existsSync(f.filePath)) {
        if (f.fileType === 'image') {
          try {
            const buf = await sharp(f.filePath)
              .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
              .jpeg({ quality: 70 })
              .toBuffer();
            thumbnailBase64 = `data:image/jpeg;base64,${buf.toString('base64')}`;
          } catch { thumbnailBase64 = null; }
        } else if (f.summary) {
          textSnippet = f.summary;
        }
      }

      return {
        ...f,
        uploaderName: userMap.get(f.uploadedBy) ?? f.uploadedBy,
        thumbnailBase64,
        textSnippet,
        createdAt: f.createdAt.toISOString(),
        updatedAt: f.updatedAt.toISOString(),
      };
    }));

    res.json({ success: true, data: previews });
  } catch (err) {
    console.error('[Library] GET /files error:', err);
    res.status(500).json({ success: false, message: '获取文件列表失败' });
  }
});

router.post(
  '/files',
  authMiddleware,
  (req: AuthRequest, res: Response, next) => {
    upload.single('file')(req, res, (err) => {
      if (err) {
        res.status(400).json({ success: false, message: err.message });
        return;
      }
      next();
    });
  },
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.userId!;
      const workspaceId = await getUserWorkspaceId(userId);
      if (!workspaceId) {
        res.status(404).json({ success: false, message: '未找到工作空间' });
        return;
      }

      const file = req.file;
      if (!file) {
        res.status(400).json({ success: false, message: '未收到文件' });
        return;
      }

      const tags: string[] = req.body.tags ? JSON.parse(req.body.tags) : [];
      const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
      const fileType = detectFileType(file.mimetype, originalName);
      const fileId = `LF${nanoid(12)}`;

      const record = await prisma.libraryFile.create({
        data: {
          fileId,
          workspaceId,
          uploadedBy: userId,
          fileName: originalName,
          fileType,
          filePath: file.path,
          fileSize: file.size,
          mimeType: file.mimetype,
          tags,
          embedStatus: 'pending',
        },
      });

      res.status(201).json({
        success: true,
        data: {
          fileId: record.fileId,
          fileName: record.fileName,
          fileType: record.fileType,
          fileSize: record.fileSize,
          tags: record.tags,
          embedStatus: record.embedStatus,
          createdAt: record.createdAt.toISOString(),
          updatedAt: record.updatedAt.toISOString(),
        },
      });

      setImmediate(() => {
        const embedLogCtx: EmbedCallContext = {
          modelCustomId: 'vector:pending-resolve',
          userId,
          userEmail: req.user?.email,
          username: req.user?.username,
        };
        runEmbedding(fileId, file.path, fileType, embedLogCtx);
      });
    } catch (err) {
      console.error('[Library] POST /files error:', err);
      res.status(500).json({ success: false, message: '上传文件失败' });
    }
  }
);

router.delete('/files/:fileId', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { fileId } = req.params as { fileId: string };

    const workspaceId = await getUserWorkspaceId(userId);
    if (!workspaceId) {
      res.status(404).json({ success: false, message: '未找到工作空间' });
      return;
    }

    const record = await prisma.libraryFile.findUnique({ where: { fileId } });
    if (!record || record.workspaceId !== workspaceId) {
      res.status(404).json({ success: false, message: '文件不存在' });
      return;
    }

    await prisma.libraryFile.delete({ where: { fileId } });

    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    console.error('[Library] DELETE /files/:fileId error:', err);
    res.status(500).json({ success: false, message: '删除文件失败' });
  }
});

router.patch('/files/:fileId', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { fileId } = req.params as { fileId: string };
    const { tags } = req.body as { tags?: string[] };

    const workspaceId = await getUserWorkspaceId(userId);
    if (!workspaceId) {
      res.status(404).json({ success: false, message: '未找到工作空间' });
      return;
    }

    const record = await prisma.libraryFile.findUnique({ where: { fileId } });
    if (!record || record.workspaceId !== workspaceId) {
      res.status(404).json({ success: false, message: '文件不存在' });
      return;
    }

    const updated = await prisma.libraryFile.update({
      where: { fileId },
      data: { ...(tags !== undefined && { tags }) },
    });

    res.json({ success: true, data: { fileId: updated.fileId, tags: updated.tags } });
  } catch (err) {
    console.error('[Library] PATCH /files/:fileId error:', err);
    res.status(500).json({ success: false, message: '更新文件失败' });
  }
});

router.get('/files/:fileId/preview', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { fileId } = req.params as { fileId: string };

    const workspaceId = await getUserWorkspaceId(userId);
    if (!workspaceId) { res.status(404).json({ success: false, message: '未找到工作空间' }); return; }

    const record = await prisma.libraryFile.findUnique({ where: { fileId } });
    if (!record || record.workspaceId !== workspaceId) {
      res.status(404).json({ success: false, message: '文件不存在' }); return;
    }

    const isOwner = record.uploadedBy === userId;

    const chunks = await prisma.$queryRaw<Array<{ chunkIdx: number; content: string }>>`
      SELECT "chunkIdx", content FROM library_chunks
      WHERE "fileId" = ${fileId}
      ORDER BY "chunkIdx" ASC
    `;

    const truncate = (text: string) => {
      const trimmed = text.trim();
      if (trimmed.length <= 20) return trimmed + '…';
      if (trimmed.length <= 300) return trimmed;
      return trimmed.slice(0, 300) + '…';
    };

    const chunkPreviews = chunks.map((c) => ({
      index: c.chunkIdx,
      content: truncate(c.content),
    }));

    let rawContent: string | null = null;
    if (isOwner && !['image', 'video'].includes(record.fileType) && fs.existsSync(record.filePath)) {
      try {
        const text = await extractTextFromFile(record.filePath, record.fileType);
        rawContent = text.trim().slice(0, 5000);
      } catch {
        rawContent = null;
      }
    }

    let imageBase64: string | null = null;
    if (isOwner && record.fileType === 'image' && fs.existsSync(record.filePath)) {
      const buf = fs.readFileSync(record.filePath);
      imageBase64 = `data:${record.mimeType};base64,${buf.toString('base64')}`;
    }

    let videoBase64: string | null = null;
    if (isOwner && record.fileType === 'video' && fs.existsSync(record.filePath)) {
      const buf = fs.readFileSync(record.filePath);
      videoBase64 = `data:${record.mimeType};base64,${buf.toString('base64')}`;
    }

    res.json({
      success: true,
      data: {
        fileId: record.fileId,
        fileName: record.fileName,
        fileType: record.fileType,
        mimeType: record.mimeType,
        isOwner,
        rawContent,
        imageBase64,
        videoBase64,
        chunks: chunkPreviews,
      },
    });
  } catch (err) {
    console.error('[Library] GET /files/:fileId/preview error:', err);
    res.status(500).json({ success: false, message: '获取预览失败' });
  }
});

router.post('/files/:fileId/retry', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { fileId } = req.params as { fileId: string };

    const workspaceId = await getUserWorkspaceId(userId);
    if (!workspaceId) {
      res.status(404).json({ success: false, message: '未找到工作空间' });
      return;
    }

    const record = await prisma.libraryFile.findUnique({ where: { fileId } });
    if (!record || record.workspaceId !== workspaceId) {
      res.status(404).json({ success: false, message: '文件不存在' });
      return;
    }

    if (record.embedStatus === 'processing') {
      res.status(400).json({ success: false, message: '向量化正在进行中' });
      return;
    }

    if (!fs.existsSync(record.filePath)) {
      res.status(400).json({ success: false, message: '原始文件已不存在，无法重试' });
      return;
    }

    res.json({ success: true, data: { retrying: true } });

    setImmediate(() => {
      const embedLogCtx: EmbedCallContext = {
        modelCustomId: 'vector:pending-resolve',
        userId,
        userEmail: req.user?.email,
        username: req.user?.username,
      };
      runEmbedding(fileId, record.filePath, record.fileType, embedLogCtx);
    });
  } catch (err) {
    console.error('[Library] POST /files/:fileId/retry error:', err);
    res.status(500).json({ success: false, message: '重试失败' });
  }
});

export default router;

export interface RagChunk {
  content: string;
  fileName: string;
  fileId: string;
  score: number;
}

export async function searchChunksByTag(
  queryEmbedding: number[],
  tag: string | null,
  workspaceId: string,
  topK = 5,
): Promise<RagChunk[]> {
  const vectorLiteral = `[${queryEmbedding.join(',')}]`;

  let rows: Array<{ content: string; fileId: string; fileName: string; score: number }>;

  if (tag) {
    rows = await prisma.$queryRaw<Array<{
      content: string;
      fileId: string;
      fileName: string;
      score: number;
    }>>`
      SELECT
        lc.content,
        lc."fileId",
        lf."fileName",
        1 - (lc.embedding <=> ${vectorLiteral}::vector) AS score
      FROM library_chunks lc
      JOIN library_files lf ON lf."fileId" = lc."fileId"
      WHERE lf."workspaceId" = ${workspaceId}
        AND lf."embedStatus" = 'done'
        AND ${tag} = ANY(lf.tags)
      ORDER BY lc.embedding <=> ${vectorLiteral}::vector
      LIMIT ${topK}
    `;
  } else {
    rows = await prisma.$queryRaw<Array<{
      content: string;
      fileId: string;
      fileName: string;
      score: number;
    }>>`
      SELECT
        lc.content,
        lc."fileId",
        lf."fileName",
        1 - (lc.embedding <=> ${vectorLiteral}::vector) AS score
      FROM library_chunks lc
      JOIN library_files lf ON lf."fileId" = lc."fileId"
      WHERE lf."workspaceId" = ${workspaceId}
        AND lf."embedStatus" = 'done'
      ORDER BY lc.embedding <=> ${vectorLiteral}::vector
      LIMIT ${topK}
    `;
  }

  return rows.map((r) => ({
    content: r.content,
    fileId: r.fileId,
    fileName: r.fileName,
    score: Number(r.score),
  }));
}
