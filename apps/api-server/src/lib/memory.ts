import { callLLMWithConfig } from './llm.js';
import { getConfigByCustomId } from '../routes/modelConfig.js';
import { prisma } from './prisma.js';

// 每隔多少条新消息触发一次记忆更新
const MEMORY_UPDATE_INTERVAL = 10;

/**
 * 获取频道的长期记忆，注入到 agent 上下文前调用
 */
export async function getChannelMemory(channelId: string): Promise<string | null> {
  const memory = await prisma.channelMemory.findUnique({ where: { channelId } });
  if (!memory) return null;

  const parts: string[] = [];
  if (memory.summary) parts.push(`群聊摘要：${memory.summary}`);
  if (memory.keyFacts.length > 0) {
    parts.push(`关键信息：\n${memory.keyFacts.map((f: string) => `- ${f}`).join('\n')}`);
  }
  return parts.length > 0 ? parts.join('\n') : null;
}

/**
 * 每次对话后异步触发记忆更新（不阻塞主流程）
 */
export function triggerMemoryUpdate(channelId: string): void {
  updateChannelMemory(channelId).catch((err) => {
    console.error(`[Memory] update failed for channel ${channelId}:`, err);
  });
}

async function updateChannelMemory(channelId: string): Promise<void> {
  // 获取当前消息总数
  const totalMessages = await prisma.message.count({ where: { channelId } });

  // 检查是否需要更新
  const existing = await prisma.channelMemory.findUnique({ where: { channelId } });
  const lastCount = existing?.messageCount ?? 0;
  if (totalMessages - lastCount < MEMORY_UPDATE_INTERVAL) return;

  // 获取最近 60 条消息用于提取（比上下文窗口更大，确保覆盖更多信息）
  const recentMessages = await prisma.message.findMany({
    where: { channelId },
    orderBy: { createdAt: 'desc' },
    take: 60,
    select: { senderName: true, senderType: true, content: true, createdAt: true },
  });
  recentMessages.reverse();

  if (recentMessages.length === 0) return;

  // 获取可用的 LLM 配置
  const fallbackConfig = await prisma.modelProviderConfig.findFirst({
    where: { apiType: 'llm', isEnabled: true },
  });
  if (!fallbackConfig) return;

  const conf = await getConfigByCustomId(fallbackConfig.customId);
  if (!conf) return;

  // 构建对话文本
  const dialogText = recentMessages
    .map((m) => `[${m.senderName}]: ${m.content}`)
    .join('\n');

  // 已有记忆作为参考
  const existingContext = existing
    ? `\n\n当前已有记忆摘要（请在此基础上更新）：\n${existing.summary}\n关键信息：${existing.keyFacts.join('；')}`
    : '';

  const extractPrompt = `你是一个信息提取助手。请从以下群聊对话中提取关键信息，用于帮助 AI 成员在后续对话中保持上下文连贯。${existingContext}

请提取：
1. 正在进行的项目或任务（名称、进度、负责人）
2. 已确认的决策或结论
3. 各成员的职责分工
4. 待办事项或下一步计划
5. 重要的背景信息

输出格式（严格按此格式，不要多余说明）：
SUMMARY: <一段话概括当前群聊的核心工作内容，50字以内>
FACTS:
- <关键事实1>
- <关键事实2>
- <关键事实3>
（最多8条，每条15字以内，只保留最重要的）

对话内容：
${dialogText}`;

  let result = '';
  const memStartMs = Date.now();
  try {
    const memResult = await callLLMWithConfig(conf, [{ role: 'user', content: extractPrompt }], '');
    result = memResult.content;
    prisma.apiCallLog.create({
      data: {
        modelCustomId: fallbackConfig.customId,
        apiType: 'llm',
        callType: 'memory',
        channelId,
        promptTokens: memResult.usage.promptTokens,
        completionTokens: memResult.usage.completionTokens,
        totalTokens: memResult.usage.totalTokens,
        durationMs: Date.now() - memStartMs,
        isSuccess: true,
      },
    }).catch((e: unknown) => console.error('[ApiCallLog] write failed:', e));
  } catch (err) {
    console.error('[Memory] LLM extraction failed:', err);
    prisma.apiCallLog.create({
      data: {
        modelCustomId: fallbackConfig.customId,
        apiType: 'llm',
        callType: 'memory',
        channelId,
        durationMs: Date.now() - memStartMs,
        isSuccess: false,
        errorMessage: err instanceof Error ? err.message : String(err),
      },
    }).catch((e: unknown) => console.error('[ApiCallLog] write failed:', e));
    return;
  }

  // 解析输出
  const summaryMatch = result.match(/SUMMARY:\s*(.+)/);
  const factsMatch = result.match(/FACTS:\n([\s\S]+)/);

  const summary = summaryMatch?.[1]?.trim() ?? '';
  const keyFacts = factsMatch?.[1]
    ? factsMatch[1]
        .split('\n')
        .map((l) => l.replace(/^-\s*/, '').trim())
        .filter((l) => l.length > 0)
        .slice(0, 8)
    : [];

  if (!summary && keyFacts.length === 0) return;

  await prisma.channelMemory.upsert({
    where: { channelId },
    create: { channelId, summary, keyFacts, messageCount: totalMessages },
    update: { summary, keyFacts, messageCount: totalMessages, lastExtractedAt: new Date() },
  });

  console.log(`[Memory] updated for channel ${channelId}: ${keyFacts.length} facts`);
}
