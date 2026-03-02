import { Router, Response } from 'express';
import { nanoid } from 'nanoid';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { callLLM, callLLMWithConfig } from '../lib/llm.js';
import { getConfigByCustomId } from './modelConfig.js';
import { callDashScopeEmbeddingAPI } from '../lib/embedding.js';
import { searchChunksByTag } from './library.js';

type CoverGenerationStatus = 'idle' | 'pending' | 'running' | 'succeeded' | 'failed';
type CoverImageProvider = 'dashscope' | 'gemini';

interface CoverStyleDefinition {
  name: string;
  description: string;
  promptExtension: string;
}

function mapDashTaskStatus(status: string | undefined): CoverGenerationStatus {
  const normalized = (status ?? '').toUpperCase();
  if (normalized === 'PENDING') return 'pending';
  if (normalized === 'RUNNING') return 'running';
  if (normalized === 'SUCCEEDED') return 'succeeded';
  return 'failed';
}

function detectCoverImageProvider(customId: string): CoverImageProvider {
  return customId.toLowerCase().includes('gemini') ? 'gemini' : 'dashscope';
}

interface GeminiInlineData {
  mimeType?: string;
  data?: string;
}

interface GeminiPart {
  text?: string;
  inlineData?: GeminiInlineData;
}

interface GeminiContent {
  role?: string;
  parts?: GeminiPart[];
}

interface GeminiCandidate {
  content?: GeminiContent;
  finishReason?: string;
}

interface GeminiErrorPayload {
  code?: number | string;
  message?: string;
  status?: string;
}

interface GeminiGenerateResponse {
  candidates?: GeminiCandidate[];
  error?: GeminiErrorPayload;
}

interface ParsedDataUrl {
  mimeType: string;
  base64Data: string;
}

function parseDataUrl(value: string): ParsedDataUrl | null {
  const match = value.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const [, mimeType, base64Data] = match;
  if (!mimeType || !base64Data) return null;
  return { mimeType, base64Data };
}

function buildGeminiParts(prompt: string, referenceImage?: string): GeminiPart[] {
  const parts: GeminiPart[] = [{ text: prompt }];
  if (!referenceImage) return parts;
  const parsedDataUrl = parseDataUrl(referenceImage);
  if (!parsedDataUrl) return parts;
  parts.push({
    inlineData: {
      mimeType: parsedDataUrl.mimeType,
      data: parsedDataUrl.base64Data,
    },
  });
  return parts;
}

function extractGeminiImageDataUrl(result: GeminiGenerateResponse): string | null {
  const candidates = result.candidates;
  if (!Array.isArray(candidates)) return null;
  for (const candidate of candidates) {
    const parts = candidate.content?.parts;
    if (!Array.isArray(parts)) continue;
    for (const part of parts) {
      const inlineData = part.inlineData;
      if (!inlineData?.data) continue;
      const mimeType = inlineData.mimeType ?? 'image/png';
      return `data:${mimeType};base64,${inlineData.data}`;
    }
  }
  return null;
}

function buildGeminiGenerateEndpoint(apiBase: string, modelName: string): { endpoint: string; includeModelInBody: boolean } {
  const trimmed = apiBase.trim().replace(/\/$/, '');
  if (trimmed.endsWith('/generateContent')) {
    return { endpoint: trimmed, includeModelInBody: true };
  }
  if (trimmed.includes(':generateContent')) {
    return { endpoint: trimmed, includeModelInBody: false };
  }
  if (/\/models\/[^/]+$/i.test(trimmed)) {
    return { endpoint: `${trimmed}:generateContent`, includeModelInBody: false };
  }
  return {
    endpoint: `${trimmed}/v1beta/models/${encodeURIComponent(modelName)}:generateContent`,
    includeModelInBody: false,
  };
}

async function requestGeminiCoverImage(
  apiBase: string,
  apiKey: string,
  modelName: string,
  prompt: string,
  referenceImage?: string,
): Promise<string> {
  const { endpoint, includeModelInBody } = buildGeminiGenerateEndpoint(apiBase, modelName);
  const requestBody = {
    ...(includeModelInBody ? { model: modelName } : {}),
    contents: [
      {
        role: 'user',
        parts: buildGeminiParts(prompt, referenceImage),
      },
    ],
    generationConfig: {
      responseModalities: ['IMAGE'],
      aspectRatio: '16:9',
    },
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (endpoint.includes('generativelanguage.googleapis.com')) {
    headers['x-goog-api-key'] = apiKey;
  } else {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  let response: globalThis.Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`封面生成失败：请求 Gemini 接口不可达（${message}）。请检查 Base URL、网络连通性与 API Key。endpoint=${endpoint}`);
  }

  const rawText = await response.text();
  let result: GeminiGenerateResponse;
  try {
    result = JSON.parse(rawText) as GeminiGenerateResponse;
  } catch {
    throw new Error(`封面生成失败：Gemini 返回非 JSON 响应，请检查 Base URL。响应片段：${rawText.slice(0, 180)}`);
  }

  if (!response.ok) {
    throw new Error(`封面生成失败（HTTP ${response.status}）：${result.error?.message ?? rawText.slice(0, 220)}`);
  }

  if (result.error?.message) {
    throw new Error(result.error.message);
  }

  const imageDataUrl = extractGeminiImageDataUrl(result);
  if (!imageDataUrl) {
    throw new Error('封面生成失败：Gemini 未返回可用图片数据');
  }
  return imageDataUrl;
}

const COVER_TASK_POLL_MAX_ATTEMPTS = 180;

function getCoverTaskPollIntervalMs(attempt: number): number {
  if (attempt <= 1) return 5000;
  if (attempt <= 8) return 15000;
  return 5000;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function queryDashScopeTask(
  apiBase: string,
  apiKey: string,
  taskId: string,
): Promise<DashScopeTaskQueryResponse> {
  const taskQueryUrl = `${apiBase}/tasks/${taskId}`;
  const queryResponse = await fetch(taskQueryUrl, {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!queryResponse.ok) {
    const errText = await queryResponse.text();
    throw new Error(`查询任务失败（HTTP ${queryResponse.status}）：${errText.slice(0, 220)}`);
  }
  return await queryResponse.json() as DashScopeTaskQueryResponse;
}

const activeCoverGenerationAssets = new Set<string>();

interface CoverGenerationJobParams {
  assetId: string;
  userId: string;
  provider: CoverImageProvider;
  modelCustomId: string;
  modelName: string;
  apiBase: string;
  apiKey: string;
  prompt: string;
  styleName: string;
  pool: string[];
  referenceImage?: string;
}

async function runCoverGenerationJob(params: CoverGenerationJobParams): Promise<void> {
  const {
    assetId,
    userId,
    provider,
    modelCustomId,
    modelName,
    apiBase,
    apiKey,
    prompt,
    styleName,
    pool,
    referenceImage,
  } = params;

  const generateUrl = `${apiBase}/services/aigc/image-generation/generation`;
  const startMs = Date.now();
  let remoteTaskId: string | null = null;

  try {
    await prisma.asset.update({
      where: { assetId },
      data: { coverGenerationStatus: 'running', coverGenerationProgress: 35 },
    });

    if (provider === 'gemini') {
      const nextCoverImage = await requestGeminiCoverImage(apiBase, apiKey, modelName, prompt, referenceImage);
      const restPool = pool.filter((style: string) => style !== styleName);

      await prisma.asset.update({
        where: { assetId },
        data: {
          coverImage: nextCoverImage,
          coverReferenceImage: null,
          coverGenerationStatus: 'succeeded',
          coverGenerationProgress: 100,
          coverGenerationTaskId: null,
          coverGenerationError: null,
          coverStylePool: restPool.length > 0 ? restPool : getAllCoverStyleNames(),
          coverGenerationFinishedAt: new Date(),
        },
      });

      prisma.apiCallLog.create({
        data: {
          modelCustomId,
          apiType: 'image',
          callType: 'cover_gen',
          userId,
          durationMs: Date.now() - startMs,
          isSuccess: true,
        },
      }).catch((e: unknown) => console.error('[ApiCallLog] write failed:', e));
      return;
    }

    const content: Array<{ text?: string; image?: string }> = [{ text: prompt }];
    if (referenceImage) {
      content.push({ image: referenceImage });
    }

    const requestBody = {
      model: modelName,
      input: {
        messages: [{ role: 'user', content }],
      },
      parameters: {
        n: 1,
        size: '1280*720',
        watermark: false,
        prompt_extend: true,
        enable_interleave: true,
      },
    };

    const response = await fetch(generateUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'X-DashScope-Async': 'enable',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`封面生成失败（HTTP ${response.status}）：${errText.slice(0, 220)}`);
    }

    const createResult = await response.json() as DashScopeTaskCreateResponse;
    if (createResult.code && createResult.code !== '200') {
      throw new Error(createResult.message ?? createResult.code);
    }

    remoteTaskId = createResult.output?.task_id ?? null;
    if (!remoteTaskId) {
      throw new Error(createResult.message ?? '封面生成失败：未返回 task_id');
    }

    await prisma.asset.update({
      where: { assetId },
      data: {
        coverGenerationTaskId: remoteTaskId,
        coverGenerationStatus: mapDashTaskStatus(createResult.output?.task_status),
        coverGenerationProgress: 45,
      },
    });

    let taskResult: DashScopeTaskQueryResponse | null = null;
    let mappedStatus: CoverGenerationStatus = 'pending';

    for (let i = 0; i < COVER_TASK_POLL_MAX_ATTEMPTS; i += 1) {
      await sleep(getCoverTaskPollIntervalMs(i));
      taskResult = await queryDashScopeTask(apiBase, apiKey, remoteTaskId);
      mappedStatus = mapDashTaskStatus(taskResult.output?.task_status);

      if (mappedStatus === 'pending' || mappedStatus === 'running') {
        const progress = Math.min(95, 45 + (i + 1) * 2);
        await prisma.asset.update({
          where: { assetId },
          data: {
            coverGenerationStatus: mappedStatus,
            coverGenerationProgress: progress,
            coverGenerationTaskId: remoteTaskId,
          },
        });
        continue;
      }

      break;
    }

    if (!taskResult) {
      throw new Error('__COVER_TASK_POLL_TIMEOUT__');
    }

    if (mappedStatus !== 'succeeded') {
      throw new Error(taskResult.message ?? taskResult.code ?? '封面生成失败');
    }

    const imageUrl = extractImageUrlFromResponse(taskResult);
    if (!imageUrl) {
      throw new Error(taskResult.message ?? '封面生成失败：未返回可用图片地址');
    }

    const nextCoverImage = imageUrl.startsWith('data:image/') ? imageUrl : await convertRemoteImageToDataUrl(imageUrl);
    const restPool = pool.filter((style: string) => style !== styleName);

    await prisma.asset.update({
      where: { assetId },
      data: {
        coverImage: nextCoverImage,
        coverReferenceImage: null,
        coverGenerationStatus: 'succeeded',
        coverGenerationProgress: 100,
        coverGenerationTaskId: null,
        coverGenerationError: null,
        coverStylePool: restPool.length > 0 ? restPool : getAllCoverStyleNames(),
        coverGenerationFinishedAt: new Date(),
      },
    });

    prisma.apiCallLog.create({
      data: {
        modelCustomId,
        apiType: 'image',
        callType: 'cover_gen',
        userId,
        durationMs: Date.now() - startMs,
        isSuccess: true,
      },
    }).catch((e: unknown) => console.error('[ApiCallLog] write failed:', e));
  } catch (err) {
    const message = err instanceof Error ? err.message : '封面生成失败';

    if (message === '__COVER_TASK_POLL_TIMEOUT__' && remoteTaskId) {
      await prisma.asset.update({
        where: { assetId },
        data: {
          coverGenerationStatus: 'running',
          coverGenerationProgress: 95,
          coverGenerationTaskId: remoteTaskId,
          coverGenerationError: null,
          coverGenerationFinishedAt: null,
        },
      }).catch((updateErr: unknown) => {
        console.error('[CoverGen] timeout handover status update error:', updateErr);
      });
      return;
    }

    await prisma.asset.update({
      where: { assetId },
      data: {
        coverGenerationStatus: 'failed',
        coverGenerationProgress: 0,
        coverGenerationTaskId: null,
        coverGenerationError: message,
        coverGenerationFinishedAt: new Date(),
      },
    }).catch((updateErr: unknown) => {
      console.error('[CoverGen] failed status update error:', updateErr);
    });

    prisma.apiCallLog.create({
      data: {
        modelCustomId,
        apiType: 'image',
        callType: 'cover_gen',
        userId,
        durationMs: Date.now() - startMs,
        isSuccess: false,
        errorMessage: message.slice(0, 500),
      },
    }).catch((e: unknown) => console.error('[ApiCallLog] write failed:', e));
  } finally {
    activeCoverGenerationAssets.delete(assetId);
  }
}

interface DashScopeTaskContentItem {
  type?: string;
  image?: string;
}

interface DashScopeTaskChoice {
  message?: {
    content?: DashScopeTaskContentItem[];
  };
}

interface DashScopeImageResponse {
  output?: {
    choices?: DashScopeTaskChoice[];
  };
  code?: string;
  message?: string;
  request_id?: string;
}

interface DashScopeTaskCreateResponse {
  output?: {
    task_id?: string;
    task_status?: string;
  };
  request_id?: string;
  code?: string;
  message?: string;
}

interface DashScopeTaskQueryResponse {
  output?: {
    task_status?: string;
    task_id?: string;
    choices?: DashScopeTaskChoice[];
  };
  code?: string;
  message?: string;
  request_id?: string;
}

const COVER_STYLE_DEFINITIONS: CoverStyleDefinition[] = [
  {
    name: '极简文字风',
    description: '画面干净，以大号设计感字体突出标题或核心观点，背景使用纯色、渐变或极简几何图形。',
    promptExtension: '采用留白和简洁构图，主标题大字突出，控制元素数量，避免复杂纹理。',
  },
  {
    name: '插画/手绘/漫画风',
    description: '通过插画或漫画风视觉强调氛围感与识别度。',
    promptExtension: '使用原创插画质感与手绘笔触，色彩有层次，画面具备故事感和情绪表达。',
  },
  {
    name: '人物/肖像风',
    description: '以核心人物形象作为主体，增强亲近感与信任感。',
    promptExtension: '以人物为视觉中心，突出面部与姿态，确保人物与标题信息关系明确。',
  },
  {
    name: '图文合成/拼贴风',
    description: '将文字、图形、图片进行杂志封面式拼贴，信息量高。',
    promptExtension: '采用杂志封面式排版，整合文字块、图形块与图片层，层次清楚但不杂乱。',
  },
  {
    name: '趣味/创意/沙雕风',
    description: '强调轻松幽默与夸张表达，优先吸引注意力。',
    promptExtension: '画面表达夸张有梗，视觉冲击强，保持可读性并避免低质噪点风。',
  },
];

function getAllCoverStyleNames(): string[] {
  return COVER_STYLE_DEFINITIONS.map((style) => style.name);
}

function normalizeDashScopeApiBase(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/$/, '');
  const apiIndex = trimmed.indexOf('/api/v1');
  if (apiIndex >= 0) {
    return trimmed.slice(0, apiIndex + '/api/v1'.length);
  }
  try {
    const url = new URL(trimmed);
    return `${url.origin}/api/v1`;
  } catch {
    return 'https://dashscope.aliyuncs.com/api/v1';
  }
}

function normalizeGeminiApiBase(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/$/, '');
  if (trimmed.length > 0) {
    return trimmed;
  }
  return 'https://generativelanguage.googleapis.com';
}

function pickCoverStyle(currentPool: string[] | null, fallbackStyle?: string | null): { styleName: string; pool: string[] } {
  const allStyles = getAllCoverStyleNames();
  const normalizedPool = Array.isArray(currentPool) && currentPool.length > 0 ? currentPool.filter((name) => allStyles.includes(name)) : allStyles;
  if (fallbackStyle && allStyles.includes(fallbackStyle)) {
    return { styleName: fallbackStyle, pool: normalizedPool.length > 0 ? normalizedPool : allStyles };
  }
  const candidatePool = normalizedPool.length > 0 ? normalizedPool : allStyles;
  const styleName = candidatePool[Math.floor(Math.random() * candidatePool.length)] ?? allStyles[0];
  return { styleName, pool: candidatePool };
}

function buildCoverPrompt(title: string, summary: string, styleName: string): string {
  const styleDef = COVER_STYLE_DEFINITIONS.find((item) => item.name === styleName) ?? COVER_STYLE_DEFINITIONS[0];
  const titleSummary = [title.trim(), summary.trim()].filter((item) => item.length > 0).join('。');
  const content = titleSummary.length > 0 ? titleSummary : title.trim();
  return [
    '根据以下内容生成一张海报，有文字和图片。请确保文字清晰可读，版式适合文章封面（16:9）。',
    `风格：${styleDef.name}。`,
    `风格描述：${styleDef.description}`,
    `内容：${content}`,
    `补充要求：${styleDef.promptExtension}`,
  ].join(' ');
}

function extractImageUrlFromResponse(result: DashScopeImageResponse): string | null {
  const choices = result.output?.choices;
  if (!Array.isArray(choices)) return null;
  for (const choice of choices) {
    const contentItems = choice.message?.content;
    if (!Array.isArray(contentItems)) continue;
    for (const item of contentItems) {
      if (item.type === 'image' && typeof item.image === 'string' && item.image.length > 0) {
        return item.image;
      }
    }
  }
  return null;
}

async function convertRemoteImageToDataUrl(imageUrl: string): Promise<string> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`下载生成图失败（${response.status}）：${errText.slice(0, 160)}`);
  }
  const mimeType = response.headers.get('content-type') ?? 'image/png';
  const buffer = Buffer.from(await response.arrayBuffer());
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

// ── 并发队列控制 ──────────────────────────────────────────
const MAX_CONCURRENT = 3;
let activeGenerations = 0;
interface QueueItem {
  assetId: string;
  agentId: string;
  title: string;
  summary: string;
  libraryTag?: string;
  workspaceId: string;
  userId: string;
  userEmail: string;
  username: string;
}
const generationQueue: QueueItem[] = [];

async function processNextInQueue(): Promise<void> {
  if (activeGenerations >= MAX_CONCURRENT || generationQueue.length === 0) return;
  const item = generationQueue.shift()!;
  await runArticleGeneration(item);
}

async function runArticleGeneration(item: QueueItem): Promise<void> {
  activeGenerations++;
  const { assetId, agentId, title, summary, libraryTag, workspaceId, userId, userEmail, username } = item;
  const startMs = Date.now();
  try {
    await prisma.asset.update({
      where: { assetId },
      data: { generationStatus: 'generating', generationProgress: 10 },
    });

    // 查询 Agent
    const agent = await prisma.agent.findUnique({ where: { agentId } });
    if (!agent) throw new Error(`Agent ${agentId} not found`);

    // RAG 检索
    let ragContext = '';
    try {
      const vectorConfig = await prisma.modelProviderConfig.findFirst({
        where: { apiType: 'vector', isEnabled: true },
        orderBy: { createdAt: 'asc' },
      });
      if (vectorConfig) {
        const { decrypt } = await import('../lib/crypto.js');
        const apiKey = decrypt(vectorConfig.apiKey);
        const queryText = `${title} ${summary}`;
        const queryEmbeddings = await callDashScopeEmbeddingAPI(
          [{ text: queryText }],
          { apiKey, modelName: vectorConfig.modelName },
          { modelCustomId: vectorConfig.customId, userId, userEmail, username },
        );
        const chunks = libraryTag
          ? await searchChunksByTag(queryEmbeddings[0], libraryTag, workspaceId, 5)
          : await searchChunksByTag(queryEmbeddings[0], null, workspaceId, 5);
        if (chunks.length > 0) {
          ragContext = chunks.map((c) => `- ${c.content}`).join('\n\n');
        }
      }
    } catch (ragErr) {
      console.error('[ArticleGen] RAG search failed:', ragErr);
    }

    await prisma.asset.update({
      where: { assetId },
      data: { generationProgress: 40 },
    });

    // 组装写作 prompt
    const skillsPart = agent.skills?.trim() ? agent.skills.trim() : '';
    const ragPart = ragContext
      ? `\n\n[知识库参考内容]\n${ragContext}`
      : '';
    const articlePrompt = [
      skillsPart,
      '',
      '[文章标题]',
      title,
      '',
      '[文章简介/方向]',
      summary,
      ragPart,
      '',
      '【注意】请直接输出正文内容，不要在正文开头或任何位置重复写出文章标题。',
    ].filter((s) => s !== undefined).join('\n');

    // 调用 LLM 生成正文
    let articleContent = '';
    let articleModelCustomId = agent.modelId ?? '';
    const articleMessages = [{ role: 'user' as const, content: articlePrompt }];
    if (agent.modelId) {
      const result = await callLLM(agent.modelId, articleMessages);
      articleContent = result.content;
      prisma.apiCallLog.create({
        data: {
          modelCustomId: agent.modelId,
          apiType: 'llm',
          callType: 'article_gen',
          userId,
          userEmail,
          username,
          promptTokens: result.usage.promptTokens,
          completionTokens: result.usage.completionTokens,
          totalTokens: result.usage.totalTokens,
          durationMs: Date.now() - startMs,
          isSuccess: true,
        },
      }).catch((e: unknown) => console.error('[ApiCallLog] write failed:', e));
    } else {
      const fallbackConfig = await prisma.modelProviderConfig.findFirst({
        where: { apiType: 'llm', isEnabled: true },
      });
      if (fallbackConfig) {
        articleModelCustomId = fallbackConfig.customId;
        const conf = await getConfigByCustomId(fallbackConfig.customId);
        if (conf) {
          const result = await callLLMWithConfig(conf, articleMessages);
          articleContent = result.content;
          prisma.apiCallLog.create({
            data: {
              modelCustomId: articleModelCustomId,
              apiType: 'llm',
              callType: 'article_gen',
              userId,
              userEmail,
              username,
              promptTokens: result.usage.promptTokens,
              completionTokens: result.usage.completionTokens,
              totalTokens: result.usage.totalTokens,
              durationMs: Date.now() - startMs,
              isSuccess: true,
            },
          }).catch((e: unknown) => console.error('[ApiCallLog] write failed:', e));
        }
      }
    }

    if (!articleContent.trim()) throw new Error('LLM returned empty article content');

    await prisma.asset.update({
      where: { assetId },
      data: { content: articleContent.trim(), generationProgress: 80 },
    });

    // 调用 LLM 生成标签 + 摘要
    const metaPrompt = `请根据以下文章内容，生成：
1. 5个标签（每个标签2-6个字）
2. 摘要（120~150字）

严格JSON输出，不要包裹在代码块中：{"tags":["...","...","...","...","..."],"summary":"..."}

文章内容：
${articleContent.trim().slice(0, 4000)}`;

    const metaMessages = [{ role: 'user' as const, content: metaPrompt }];
    let metaTags: string[] = [];
    let metaSummary = '';
    try {
      let metaResult = null;
      if (agent.modelId) {
        metaResult = await callLLM(agent.modelId, metaMessages);
      } else {
        const fallbackConfig = await prisma.modelProviderConfig.findFirst({
          where: { apiType: 'llm', isEnabled: true },
        });
        if (fallbackConfig) {
          const conf = await getConfigByCustomId(fallbackConfig.customId);
          if (conf) metaResult = await callLLMWithConfig(conf, metaMessages);
        }
      }
      if (metaResult) {
        const raw = metaResult.content.trim();
        const jsonMatch = raw.match(/```json\s*([\s\S]*?)```/) ?? raw.match(/(\{[\s\S]*\})/);
        const cleanJson = jsonMatch ? (jsonMatch[1] ?? jsonMatch[0]) : raw;
        const parsed = JSON.parse(cleanJson) as { tags?: string[]; summary?: string };
        metaTags = Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5) : [];
        metaSummary = typeof parsed.summary === 'string' ? parsed.summary : '';
      }
    } catch (metaErr) {
      console.error('[ArticleGen] meta generation failed:', metaErr);
    }

    await prisma.asset.update({
      where: { assetId },
      data: {
        tags: metaTags,
        summary: metaSummary,
        generationStatus: 'done',
        generationProgress: 100,
      },
    });

    console.log(`[ArticleGen] Done: ${assetId}`);
  } catch (err) {
    console.error(`[ArticleGen] Failed for ${assetId}:`, err);
    prisma.apiCallLog.create({
      data: {
        modelCustomId: 'unknown',
        apiType: 'llm',
        callType: 'article_gen',
        userId,
        userEmail,
        username,
        durationMs: Date.now() - startMs,
        isSuccess: false,
        errorMessage: err instanceof Error ? err.message : String(err),
      },
    }).catch((e: unknown) => console.error('[ApiCallLog] write failed:', e));
    await prisma.asset.update({
      where: { assetId },
      data: { generationStatus: 'error', generationProgress: 0 },
    }).catch(() => {});
  } finally {
    activeGenerations--;
    processNextInQueue().catch((e: unknown) => console.error('[ArticleGen] queue error:', e));
  }
}

const router = Router();

async function getUserWorkspaceId(userId: string): Promise<string | null> {
  const member = await prisma.workspaceMember.findFirst({
    where: { userId },
    include: { workspace: true },
  });
  return member?.workspace.workspaceId ?? null;
}

// POST /assets/generate-article - 触发文章生成（异步，立即返回 202）
router.post('/generate-article', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { assetId, agentId, title, summary, libraryTag } = req.body as {
      assetId: string;
      agentId: string;
      title: string;
      summary: string;
      libraryTag?: string;
    };

    if (!assetId || !agentId || !title) {
      res.status(400).json({ success: false, message: '缺少必要参数' });
      return;
    }

    const workspaceId = await getUserWorkspaceId(userId);
    if (!workspaceId) { res.status(404).json({ success: false, message: '未找到工作空间' }); return; }

    const user = await prisma.user.findUnique({ where: { userId } });
    if (!user) { res.status(404).json({ success: false, message: '用户不存在' }); return; }

    const queueItem: QueueItem = {
      assetId,
      agentId,
      title,
      summary: summary ?? '',
      libraryTag,
      workspaceId,
      userId,
      userEmail: user.email,
      username: user.username,
    };

    if (activeGenerations >= MAX_CONCURRENT) {
      // 入队等待 - 先同步写库，确保前端 SWR 刷新后能看到 queued 状态
      await prisma.asset.update({
        where: { assetId },
        data: { generationStatus: 'queued', generationProgress: 0 },
      });
      generationQueue.push(queueItem);
      res.status(202).json({ success: true, data: { status: 'queued' } });
    } else {
      // 立即开始 - 先同步写库为 generating，确保前端 SWR 刷新后能看到进度条并激活轮询
      await prisma.asset.update({
        where: { assetId },
        data: { generationStatus: 'generating', generationProgress: 10 },
      });
      runArticleGeneration(queueItem).catch((e: unknown) =>
        console.error('[ArticleGen] runArticleGeneration error:', e)
      );
      res.status(202).json({ success: true, data: { status: 'generating' } });
    }
  } catch (err) {
    console.error('[Assets] POST /generate-article error:', err);
    res.status(500).json({ success: false, message: '触发生成失败' });
  }
});

router.post('/items/:assetId/generate-cover', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { assetId } = req.params as { assetId: string };
    const { referenceImage } = req.body as { referenceImage?: string };

    const workspaceId = await getUserWorkspaceId(userId);
    if (!workspaceId) { res.status(404).json({ success: false, message: '未找到工作空间' }); return; }

    const asset = await prisma.asset.findFirst({ where: { assetId, workspaceId } });
    if (!asset) { res.status(404).json({ success: false, message: '资产不存在' }); return; }

    if (activeCoverGenerationAssets.has(assetId) || asset.coverGenerationStatus === 'pending' || asset.coverGenerationStatus === 'running') {
      res.status(409).json({ success: false, message: '封面正在生成中，请稍后' });
      return;
    }

    const imageConfig = await prisma.modelProviderConfig.findFirst({
      where: { apiType: 'image', isEnabled: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!imageConfig) {
      res.status(400).json({ success: false, message: '未找到可用的图片生成 API，请先在后台配置 image 类型接口' });
      return;
    }

    const { decrypt } = await import('../lib/crypto.js');
    const apiKey = decrypt(imageConfig.apiKey);
    const provider = detectCoverImageProvider(imageConfig.customId);
    const apiBase = provider === 'gemini'
      ? normalizeGeminiApiBase(imageConfig.baseUrl)
      : normalizeDashScopeApiBase(imageConfig.baseUrl);

    const { styleName, pool } = pickCoverStyle(asset.coverStylePool, null);
    const prompt = buildCoverPrompt(asset.title, asset.summary ?? '', styleName);
    const normalizedReferenceImage = typeof referenceImage === 'string' && referenceImage.trim().length > 0
      ? referenceImage.trim()
      : undefined;
    const taskId = `local-cover-${nanoid(10)}`;

    await prisma.asset.update({
      where: { assetId },
      data: {
        coverReferenceImage: normalizedReferenceImage ?? asset.coverReferenceImage,
        coverGenerationStatus: 'pending',
        coverGenerationProgress: 10,
        coverGenerationTaskId: taskId,
        coverGenerationError: null,
        coverGenerationStyle: styleName,
        coverStylePool: pool,
        coverGenerationStartedAt: new Date(),
        coverGenerationFinishedAt: null,
      },
    });

    activeCoverGenerationAssets.add(assetId);
    runCoverGenerationJob({
      assetId,
      userId,
      provider,
      modelCustomId: imageConfig.customId,
      modelName: imageConfig.modelName,
      apiBase,
      apiKey,
      prompt,
      styleName,
      pool,
      referenceImage: normalizedReferenceImage,
    }).catch((err: unknown) => {
      console.error('[CoverGen] runCoverGenerationJob unexpected error:', err);
      activeCoverGenerationAssets.delete(assetId);
    });

    res.status(202).json({
      success: true,
      data: {
        coverGenerationStatus: 'pending',
        coverGenerationProgress: 10,
        coverGenerationTaskId: taskId,
        coverGenerationStyle: styleName,
      },
    });
  } catch (err) {
    console.error('[Assets] POST /items/:assetId/generate-cover error:', err);
    res.status(500).json({ success: false, message: err instanceof Error ? err.message : '触发封面生成失败' });
  }
});

router.get('/items/:assetId/cover-generation-status', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { assetId } = req.params as { assetId: string };
    const workspaceId = await getUserWorkspaceId(userId);
    if (!workspaceId) { res.status(404).json({ success: false, message: '未找到工作空间' }); return; }

    const asset = await prisma.asset.findFirst({ where: { assetId, workspaceId } });
    if (!asset) { res.status(404).json({ success: false, message: '资产不存在' }); return; }

    const currentStatus = asset.coverGenerationStatus as CoverGenerationStatus;
    let updated = asset;

    if ((currentStatus === 'pending' || currentStatus === 'running') && !activeCoverGenerationAssets.has(assetId)) {
      if (asset.coverGenerationTaskId && !asset.coverGenerationTaskId.startsWith('local-cover-')) {
        try {
          const imageConfig = await prisma.modelProviderConfig.findFirst({
            where: { apiType: 'image', isEnabled: true },
            orderBy: { createdAt: 'asc' },
          });
          if (imageConfig) {
            const { decrypt } = await import('../lib/crypto.js');
            const apiKey = decrypt(imageConfig.apiKey);
            const apiBase = normalizeDashScopeApiBase(imageConfig.baseUrl);
            const taskResult = await queryDashScopeTask(apiBase, apiKey, asset.coverGenerationTaskId);
            const mappedStatus = mapDashTaskStatus(taskResult.output?.task_status);

            if (mappedStatus === 'pending' || mappedStatus === 'running') {
              updated = await prisma.asset.update({
                where: { assetId },
                data: {
                  coverGenerationStatus: mappedStatus,
                  coverGenerationProgress: Math.max(asset.coverGenerationProgress ?? 0, mappedStatus === 'running' ? 70 : 55),
                  coverGenerationError: null,
                },
              });
            } else if (mappedStatus === 'succeeded') {
              const imageUrl = extractImageUrlFromResponse(taskResult);
              if (!imageUrl) {
                updated = await prisma.asset.update({
                  where: { assetId },
                  data: {
                    coverGenerationStatus: 'failed',
                    coverGenerationProgress: 0,
                    coverGenerationTaskId: null,
                    coverGenerationError: taskResult.message ?? '任务成功但未返回图片',
                    coverGenerationFinishedAt: new Date(),
                  },
                });
              } else {
                const nextCoverImage = imageUrl.startsWith('data:image/') ? imageUrl : await convertRemoteImageToDataUrl(imageUrl);
                const restPool = (asset.coverStylePool ?? []).filter((style: string) => style !== asset.coverGenerationStyle);
                updated = await prisma.asset.update({
                  where: { assetId },
                  data: {
                    coverImage: nextCoverImage,
                    coverReferenceImage: null,
                    coverGenerationStatus: 'succeeded',
                    coverGenerationProgress: 100,
                    coverGenerationTaskId: null,
                    coverGenerationError: null,
                    coverStylePool: restPool.length > 0 ? restPool : getAllCoverStyleNames(),
                    coverGenerationFinishedAt: new Date(),
                  },
                });
              }
            } else {
              updated = await prisma.asset.update({
                where: { assetId },
                data: {
                  coverGenerationStatus: 'failed',
                  coverGenerationProgress: 0,
                  coverGenerationTaskId: null,
                  coverGenerationError: taskResult.message ?? taskResult.code ?? '封面生成失败',
                  coverGenerationFinishedAt: new Date(),
                },
              });
            }
          }
        } catch (queryErr) {
          console.error('[CoverGen] status recovery query failed:', queryErr);
        }
      } else {
        updated = await prisma.asset.update({
          where: { assetId },
          data: {
            coverGenerationStatus: 'failed',
            coverGenerationProgress: 0,
            coverGenerationTaskId: null,
            coverGenerationError: '生成任务已中断，请重新点击 AI 生成',
            coverGenerationFinishedAt: new Date(),
          },
        });
      }
    }

    res.json({
      success: true,
      data: {
        coverGenerationStatus: updated.coverGenerationStatus,
        coverGenerationProgress: updated.coverGenerationProgress,
        coverGenerationTaskId: updated.coverGenerationTaskId,
        coverGenerationError: updated.coverGenerationError,
        coverGenerationStyle: updated.coverGenerationStyle,
        hasReferenceImage: Boolean(updated.coverReferenceImage),
        coverImage: updated.coverImage,
      },
    });
  } catch (err) {
    console.error('[Assets] GET /items/:assetId/cover-generation-status error:', err);
    res.status(500).json({ success: false, message: err instanceof Error ? err.message : '查询封面状态失败' });
  }
});

router.post('/items', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const workspaceId = await getUserWorkspaceId(userId);
    if (!workspaceId) { res.status(404).json({ success: false, message: '未找到工作空间' }); return; }

    const { title, assetType, content, coverImage, tags } = req.body as {
      title?: string;
      assetType?: string;
      content?: string;
      coverImage?: string;
      tags?: string[];
    };

    const asset = await prisma.asset.create({
      data: {
        assetId: nanoid(),
        workspaceId,
        createdById: userId,
        title: title ?? '新页面',
        assetType: assetType ?? '文章',
        content: content ?? '',
        coverImage: coverImage ?? null,
        tags: tags ?? [],
        generationStatus: 'idle',
        generationProgress: 0,
      },
    });

    res.json({ success: true, data: asset });
  } catch (err) {
    console.error('[Assets] POST /items error:', err);
    res.status(500).json({ success: false, message: '创建资产失败' });
  }
});

router.get('/items', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const workspaceId = await getUserWorkspaceId(userId);
    if (!workspaceId) { res.status(404).json({ success: false, message: '未找到工作空间' }); return; }

    const assets = await prisma.asset.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({
      success: true,
      data: assets.map((a) => ({
        ...a,
        generationStatus: a.generationStatus ?? 'idle',
        generationProgress: a.generationProgress ?? 0,
      })),
    });
  } catch (err) {
    console.error('[Assets] GET /items error:', err);
    res.status(500).json({ success: false, message: '获取资产失败' });
  }
});

router.delete('/items', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { ids } = req.body as { ids: string[] };
    if (!Array.isArray(ids) || ids.length === 0) { res.status(400).json({ success: false, message: '请提供要删除的资产 ID' }); return; }

    const workspaceId = await getUserWorkspaceId(userId);
    if (!workspaceId) { res.status(404).json({ success: false, message: '未找到工作空间' }); return; }

    await prisma.asset.deleteMany({ where: { assetId: { in: ids }, workspaceId } });
    res.json({ success: true });
  } catch (err) {
    console.error('[Assets] DELETE /items error:', err);
    res.status(500).json({ success: false, message: '删除资产失败' });
  }
});

router.get('/items/:assetId', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { assetId } = req.params as { assetId: string };
    const workspaceId = await getUserWorkspaceId(userId);
    if (!workspaceId) { res.status(404).json({ success: false, message: '未找到工作空间' }); return; }

    const asset = await prisma.asset.findFirst({ where: { assetId, workspaceId } });
    if (!asset) { res.status(404).json({ success: false, message: '资产不存在' }); return; }
    res.json({
      success: true,
      data: {
        ...asset,
        generationStatus: asset.generationStatus ?? 'idle',
        generationProgress: asset.generationProgress ?? 0,
      },
    });
  } catch (err) {
    console.error('[Assets] GET /items/:assetId error:', err);
    res.status(500).json({ success: false, message: '获取资产失败' });
  }
});

router.patch('/items/:assetId', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { assetId } = req.params as { assetId: string };
    const { tags, title, content, coverImage, summary, coverReferenceImage } = req.body as {
      tags?: string[];
      title?: string;
      content?: string;
      coverImage?: string | null;
      summary?: string;
      coverReferenceImage?: string | null;
    };

    const workspaceId = await getUserWorkspaceId(userId);
    if (!workspaceId) { res.status(404).json({ success: false, message: '未找到工作空间' }); return; }

    const data: Record<string, unknown> = {};
    if (tags !== undefined) data.tags = tags;
    if (title !== undefined) data.title = title;
    if (content !== undefined) data.content = content;
    if (coverImage !== undefined) data.coverImage = coverImage;
    if (summary !== undefined) data.summary = summary;
    if (coverReferenceImage !== undefined) data.coverReferenceImage = coverReferenceImage;

    await prisma.asset.update({ where: { assetId }, data });
    res.json({ success: true });
  } catch (err) {
    console.error('[Assets] PATCH /items/:assetId error:', err);
    res.status(500).json({ success: false, message: '更新资产失败' });
  }
});

router.post('/items/:assetId/share', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { assetId } = req.params as { assetId: string };
    const workspaceId = await getUserWorkspaceId(userId);
    if (!workspaceId) { res.status(404).json({ success: false, message: '未找到工作空间' }); return; }

    const asset = await prisma.asset.findFirst({ where: { assetId, workspaceId } });
    if (!asset) { res.status(404).json({ success: false, message: '资产不存在' }); return; }

    const token = nanoid(24);
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);

    await prisma.asset.update({
      where: { assetId },
      data: { shareToken: token, shareExpiresAt: expiresAt },
    });

    res.json({ success: true, data: { shareToken: token, shareExpiresAt: expiresAt.toISOString() } });
  } catch (err) {
    console.error('[Assets] POST /items/:assetId/share error:', err);
    res.status(500).json({ success: false, message: '创建分享失败' });
  }
});

router.delete('/items/:assetId/share', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { assetId } = req.params as { assetId: string };
    const workspaceId = await getUserWorkspaceId(userId);
    if (!workspaceId) { res.status(404).json({ success: false, message: '未找到工作空间' }); return; }

    await prisma.asset.update({
      where: { assetId },
      data: { shareToken: null, shareExpiresAt: null },
    });

    res.json({ success: true });
  } catch (err) {
    console.error('[Assets] DELETE /items/:assetId/share error:', err);
    res.status(500).json({ success: false, message: '取消分享失败' });
  }
});

router.get('/tags', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const workspaceId = await getUserWorkspaceId(userId);
    if (!workspaceId) { res.status(404).json({ success: false, message: '未找到工作空间' }); return; }

    const folderTags = await prisma.assetFolderTag.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ success: true, data: folderTags.map((t: { name: string }) => t.name) });
  } catch (err) {
    console.error('[Assets] GET /tags error:', err);
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

    await prisma.assetFolderTag.upsert({
      where: { workspaceId_name: { workspaceId, name: tag.trim() } },
      create: { workspaceId, name: tag.trim() },
      update: {},
    });
    res.json({ success: true, data: { tag: tag.trim() } });
  } catch (err) {
    console.error('[Assets] POST /tags error:', err);
    res.status(500).json({ success: false, message: '创建标签失败' });
  }
});

router.delete('/tags/:tag', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const tag = decodeURIComponent(req.params.tag as string);
    const workspaceId = await getUserWorkspaceId(userId);
    if (!workspaceId) { res.status(404).json({ success: false, message: '未找到工作空间' }); return; }

    await prisma.assetFolderTag.deleteMany({ where: { workspaceId, name: tag } });
    res.json({ success: true, data: { deleted: tag } });
  } catch (err) {
    console.error('[Assets] DELETE /tags/:tag error:', err);
    res.status(500).json({ success: false, message: '删除标签失败' });
  }
});

export { nanoid };
export default router;
