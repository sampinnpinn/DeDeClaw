import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { prisma } from './prisma.js';
import { decrypt } from './crypto.js';

export interface EmbedCallContext {
  modelCustomId?: string;
  userId?: string;
  userEmail?: string;
  username?: string;
}

const VECTOR_LOG_FALLBACK_MODEL_ID = 'vector:unknown';

function resolveLogModelCustomId(logCtx?: EmbedCallContext): string {
  if (logCtx?.modelCustomId && logCtx.modelCustomId.trim()) {
    return logCtx.modelCustomId;
  }
  return VECTOR_LOG_FALLBACK_MODEL_ID;
}

function writeVectorCallLog(
  logCtx: EmbedCallContext,
  data: { durationMs: number; isSuccess: boolean; errorMessage?: string },
): void {
  prisma.apiCallLog.create({
    data: {
      modelCustomId: resolveLogModelCustomId(logCtx),
      apiType: 'vector',
      callType: 'rag_embed',
      userId: logCtx.userId,
      userEmail: logCtx.userEmail,
      username: logCtx.username,
      durationMs: data.durationMs,
      isSuccess: data.isSuccess,
      ...(data.errorMessage ? { errorMessage: data.errorMessage } : {}),
    },
  }).catch((e: unknown) => console.error('[ApiCallLog] write failed:', e));
}

const require = createRequire(import.meta.url);

interface EmbedChunk {
  content: string;
  embedding: number[];
}

async function getVectorConfig(logCtx?: EmbedCallContext) {
  const config = await prisma.modelProviderConfig.findFirst({
    where: { apiType: 'vector', isEnabled: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!config) {
    const errorMessage = '未找到启用的向量化模型配置（apiType=vector）';
    if (logCtx) {
      writeVectorCallLog(logCtx, { durationMs: 0, isSuccess: false, errorMessage });
    }
    throw new Error(errorMessage);
  }
  return {
    customId: config.customId,
    baseUrl: config.baseUrl,
    modelName: config.modelName,
    apiKey: decrypt(config.apiKey),
  };
}

type MultimodalContent = { text: string } | { image: string };

export async function callDashScopeEmbeddingAPI(
  contents: MultimodalContent[],
  config: { apiKey: string; modelName: string },
  logCtx?: EmbedCallContext,
): Promise<number[][]> {
  const url = 'https://dashscope.aliyuncs.com/api/v1/services/embeddings/multimodal-embedding/multimodal-embedding';
  const startMs = Date.now();

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.modelName,
        input: { contents },
        parameters: { dimension: 1536 },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      if (logCtx) {
        writeVectorCallLog(logCtx, {
          durationMs: Date.now() - startMs,
          isSuccess: false,
          errorMessage: `HTTP ${response.status}: ${errText.slice(0, 200)}`,
        });
      }
      throw new Error(`DashScope Embedding API error ${response.status}: ${errText}`);
    }

    const data = (await response.json()) as {
      output: { embeddings: Array<{ index: number; embedding: number[] }> };
    };

    if (logCtx) {
      writeVectorCallLog(logCtx, { durationMs: Date.now() - startMs, isSuccess: true });
    }

    return data.output.embeddings
      .sort((a, b) => a.index - b.index)
      .map((e) => e.embedding);
  } catch (err) {
    if (logCtx && !(err instanceof Error && err.message.startsWith('DashScope Embedding API error'))) {
      writeVectorCallLog(logCtx, {
        durationMs: Date.now() - startMs,
        isSuccess: false,
        errorMessage: err instanceof Error ? err.message : String(err),
      });
    }
    throw err;
  }
}

function chunkText(text: string, chunkSize = 500): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n{2,}/);
  let current = '';

  for (const para of paragraphs) {
    if ((current + para).length > chunkSize && current.length > 0) {
      chunks.push(current.trim());
      current = para;
    } else {
      current = current ? `${current}\n\n${para}` : para;
    }
  }

  if (current.trim()) chunks.push(current.trim());

  const result: string[] = [];
  for (const chunk of chunks) {
    if (chunk.length <= chunkSize) {
      result.push(chunk);
    } else {
      for (let i = 0; i < chunk.length; i += chunkSize) {
        result.push(chunk.slice(i, i + chunkSize));
      }
    }
  }

  return result.filter((c) => c.trim().length > 10);
}

export async function extractTextFromFile(filePath: string, fileType: string): Promise<string> {
  const buffer = fs.readFileSync(filePath);

  if (fileType === 'md') {
    return buffer.toString('utf-8');
  }

  if (fileType === 'pdf') {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
    const pdfDoc = await loadingTask.promise;
    const pages: string[] = [];
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const content = await page.getTextContent();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pageText = content.items.map((item: any) => item.str ?? '').join(' ');
      pages.push(pageText);
    }
    return pages.join('\n');
  }

  if (fileType === 'doc' || fileType === 'docx') {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (fileType === 'xls' || fileType === 'xlsx' || fileType === 'excel') {
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const texts: string[] = [];
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet);
      texts.push(`[Sheet: ${sheetName}]\n${csv}`);
    }
    return texts.join('\n\n');
  }

  throw new Error(`不支持的文件类型: ${fileType}`);
}

export async function embedFile(
  filePath: string,
  fileType: string,
  logCtx?: EmbedCallContext,
): Promise<EmbedChunk[]> {
  const vectorConfig = await getVectorConfig(logCtx);
  const embedLogCtx = logCtx
    ? { ...logCtx, modelCustomId: vectorConfig.customId }
    : undefined;

  if (fileType === 'image') {
    const buffer = fs.readFileSync(filePath);
    const base64 = buffer.toString('base64');
    const ext = path.extname(filePath).slice(1).toLowerCase();
    const mimeType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
    const dataUrl = `data:${mimeType};base64,${base64}`;

    const embeddings = await callDashScopeEmbeddingAPI([{ image: dataUrl }], vectorConfig, embedLogCtx);
    return [{ content: `[图片] ${path.basename(filePath)}`, embedding: embeddings[0] }];
  }

  const rawText = await extractTextFromFile(filePath, fileType);
  if (!rawText.trim()) return [];
  const textChunks = chunkText(rawText);
  if (textChunks.length === 0) return [];

  const allEmbeddings: number[][] = [];
  for (const chunk of textChunks) {
    const embeddings = await callDashScopeEmbeddingAPI([{ text: chunk }], vectorConfig, embedLogCtx);
    allEmbeddings.push(embeddings[0]);
  }

  return textChunks.map((content, idx) => ({
    content,
    embedding: allEmbeddings[idx],
  }));
}
