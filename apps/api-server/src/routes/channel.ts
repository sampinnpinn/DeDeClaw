import { Router, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { nanoid } from 'nanoid';
import { callLLM, callLLMWithConfig, callLLMStream, callLLMWithConfigStream } from '../lib/llm.js';
import type { LLMResult } from '../lib/llm.js';
import { getConfigByCustomId } from './modelConfig.js';
import { getChannelMemory, triggerMemoryUpdate } from '../lib/memory.js';
import { searchChunksByTag } from './library.js';
import { callDashScopeEmbeddingAPI } from '../lib/embedding.js';

const router = Router();

type IntentType = 'news' | 'qa' | 'task' | 'chat';
type IntentConfidence = 'low' | 'medium' | 'high';

interface IntentAnalysis {
  originalContent: string;
  normalizedContent: string;
  intentType: IntentType;
  confidence: IntentConfidence;
}

type ChannelCreationContext = 'hired-talent-chat';

interface ChannelResponseData {
  channelId: string;
  name: string;
  avatar: string | null;
  agentIds: string[];
  isMuted: boolean;
  lastMessage: string | null;
  lastMessageTime: string;
  createdAt: string;
}

function formatChannelResponse(channel: {
  channelId: string;
  name: string;
  avatar: string | null;
  agentIds: string[];
  isMuted: boolean;
  lastMessage: string | null;
  lastMessageTime: Date;
  createdAt: Date;
}): ChannelResponseData {
  return {
    channelId: channel.channelId,
    name: channel.name,
    avatar: channel.avatar,
    agentIds: channel.agentIds,
    isMuted: channel.isMuted,
    lastMessage: channel.lastMessage,
    lastMessageTime: channel.lastMessageTime.toISOString(),
    createdAt: channel.createdAt.toISOString(),
  };
}

function isTalentDirectChannel(agentIds: string[]): boolean {
  return agentIds.length === 1;
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripMentionTokens(content: string, agentNames: string[]): string {
  let normalized = content;

  const sortedNames = [...agentNames]
    .filter((name) => name.trim().length > 0)
    .sort((a, b) => b.length - a.length);

  for (const name of sortedNames) {
    const escapedName = escapeRegExp(name);
    const mentionPattern = new RegExp(`(^|\\s)@${escapedName}(?=[\\s，。！？,.!?:：；;]|$)`, 'g');
    normalized = normalized.replace(mentionPattern, '$1');
  }

  return normalized.replace(/\s+/g, ' ').trim();
}

function analyzeUserIntent(content: string, agentNames: string[]): IntentAnalysis {
  const normalizedContent = stripMentionTokens(content, agentNames);
  const target = normalizedContent || content;

  if (/(最新|热点|新闻|资讯|动态)/.test(target)) {
    return {
      originalContent: content,
      normalizedContent,
      intentType: 'news',
      confidence: 'high',
    };
  }

  if (/(怎么|如何|为什么|是否|能否|\?|？)/.test(target)) {
    return {
      originalContent: content,
      normalizedContent,
      intentType: 'qa',
      confidence: 'medium',
    };
  }

  if (/(写|生成|整理|总结|规划|计划|输出|制作)/.test(target)) {
    return {
      originalContent: content,
      normalizedContent,
      intentType: 'task',
      confidence: 'medium',
    };
  }

  return {
    originalContent: content,
    normalizedContent,
    intentType: 'chat',
    confidence: 'low',
  };
}

router.post('/create', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const {
      agentIds,
      name,
      avatar,
      creationContext,
    }: {
      agentIds?: unknown;
      name?: unknown;
      avatar?: unknown;
      creationContext?: ChannelCreationContext;
    } = req.body;

    if (typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ success: false, message: '频道名称不能为空' });
      return;
    }

    if (avatar !== undefined && avatar !== null && typeof avatar !== 'string') {
      res.status(400).json({ success: false, message: '频道头像格式不正确' });
      return;
    }

    if (creationContext !== undefined && creationContext !== 'hired-talent-chat') {
      res.status(400).json({ success: false, message: '无效的频道创建场景' });
      return;
    }

    if (!Array.isArray(agentIds)) {
      res.status(400).json({ success: false, message: '请选择频道成员' });
      return;
    }

    const normalizedAgentIds = Array.from(
      new Set(agentIds.filter((agentId): agentId is string => typeof agentId === 'string' && agentId.trim().length > 0)),
    );

    const isHiredTalentChat = creationContext === 'hired-talent-chat';

    if (isHiredTalentChat) {
      if (normalizedAgentIds.length !== 1) {
        res.status(400).json({ success: false, message: '人才会话仅允许选择 1 名 Agent' });
        return;
      }
    } else if (normalizedAgentIds.length < 2) {
      res.status(400).json({ success: false, message: '至少需要选择 2 名 Agent' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { userId },
      include: {
        workspaceMembers: {
          include: {
            workspace: true,
          },
        },
      },
    });

    if (!user || user.workspaceMembers.length === 0) {
      res.status(404).json({ success: false, message: '用户或工作空间不存在' });
      return;
    }
    const workspaceId = user.workspaceMembers[0].workspace.workspaceId;

    if (isHiredTalentChat) {
      const talentAgentId = normalizedAgentIds[0];
      const hire = await prisma.agentHire.findUnique({
        where: {
          userId_agentId: {
            userId,
            agentId: talentAgentId,
          },
        },
      });

      if (!hire?.isActive) {
        res.status(403).json({ success: false, message: '仅可为已雇佣人才创建会话' });
        return;
      }

      const existingChannel = await prisma.channel.findFirst({
        where: {
          workspaceId,
          createdById: userId,
          agentIds: {
            equals: [talentAgentId],
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (existingChannel) {
        res.json({
          success: true,
          data: formatChannelResponse(existingChannel),
        });
        return;
      }
    }

    const channel = await prisma.channel.create({
      data: {
        channelId: `CH${nanoid(10)}`,
        name: name.trim(),
        avatar: avatar || null,
        workspaceId,
        createdById: userId,
        agentIds: normalizedAgentIds,
        lastMessage: '频道已创建',
      },
    });

    res.json({
      success: true,
      data: formatChannelResponse(channel),
    });
  } catch (error) {
    console.error('Create channel error:', error);
    res.status(500).json({ success: false, message: '创建频道失败' });
  }
});

router.post('/:channelId/members', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { channelId } = req.params as { channelId: string };
    const { agentIds } = req.body;

    if (!agentIds || !Array.isArray(agentIds) || agentIds.length === 0) {
      res.status(400).json({ success: false, message: '请选择要添加的成员' });
      return;
    }

    const channel = await prisma.channel.findUnique({ where: { channelId } });
    if (!channel) {
      res.status(404).json({ success: false, message: '频道不存在' });
      return;
    }

    if (isTalentDirectChannel(channel.agentIds)) {
      res.status(403).json({ success: false, message: '人才会话不支持添加成员' });
      return;
    }

    const merged = Array.from(new Set([...channel.agentIds, ...agentIds]));

    const updated = await prisma.channel.update({
      where: { channelId },
      data: { agentIds: merged },
    });

    res.json({ success: true, data: { agentIds: updated.agentIds } });
  } catch (error) {
    console.error('Add members error:', error);
    res.status(500).json({ success: false, message: '添加成员失败' });
  }
});

router.delete('/:channelId/members/:agentId', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { channelId, agentId } = req.params as { channelId: string; agentId: string };

    const channel = await prisma.channel.findUnique({ where: { channelId } });
    if (!channel) {
      res.status(404).json({ success: false, message: '频道不存在' });
      return;
    }

    if (isTalentDirectChannel(channel.agentIds)) {
      res.status(403).json({ success: false, message: '人才会话不支持移除成员' });
      return;
    }

    const updated = await prisma.channel.update({
      where: { channelId },
      data: { agentIds: channel.agentIds.filter((id) => id !== agentId) },
    });

    res.json({ success: true, data: { agentIds: updated.agentIds } });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ success: false, message: '移除成员失败' });
  }
});

router.put('/:channelId', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { channelId } = req.params as { channelId: string };
    const { name, avatar, isMuted } = req.body;

    const channel = await prisma.channel.findUnique({
      where: { channelId },
    });

    if (!channel) {
      res.status(404).json({ success: false, message: '频道不存在' });
      return;
    }

    if (channel.createdById !== userId) {
      res.status(403).json({ success: false, message: '无权修改此频道' });
      return;
    }

    if (isTalentDirectChannel(channel.agentIds) && (name !== undefined || avatar !== undefined)) {
      res.status(403).json({ success: false, message: '人才会话不支持修改频道名称或头像' });
      return;
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (avatar !== undefined) updateData.avatar = avatar;
    if (isMuted !== undefined) updateData.isMuted = isMuted;

    const updated = await prisma.channel.update({
      where: { channelId },
      data: updateData,
    });

    res.json({
      success: true,
      data: {
        channelId: updated.channelId,
        name: updated.name,
        avatar: updated.avatar,
        agentIds: updated.agentIds,
        isMuted: updated.isMuted,
        lastMessage: updated.lastMessage,
        lastMessageTime: updated.lastMessageTime.toISOString(),
      },
    });
  } catch (error) {
    console.error('Update channel error:', error);
    res.status(500).json({ success: false, message: '更新频道失败' });
  }
});

router.get('/list', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;

    const user = await prisma.user.findUnique({
      where: { userId },
      include: {
        workspaceMembers: {
          include: {
            workspace: true,
          },
        },
      },
    });

    if (!user || user.workspaceMembers.length === 0) {
      res.json({ success: true, data: [] });
      return;
    }

    const workspaceId = user.workspaceMembers[0].workspace.workspaceId;

    const channels = await prisma.channel.findMany({
      where: {
        workspaceId,
      },
      orderBy: {
        lastMessageTime: 'desc',
      },
    });

    // 查每个频道最后一条消息的发送者
    const lastMessages = await Promise.all(
      channels.map((ch) =>
        prisma.message.findFirst({
          where: { channelId: ch.channelId },
          orderBy: { createdAt: 'desc' },
          select: { senderType: true, senderName: true },
        })
      )
    );

    const formattedChannels = channels.map((channel, i) => {
      const lastMsg = lastMessages[i];
      const lastMessageSenderName =
        lastMsg?.senderType === 'agent' ? lastMsg.senderName : undefined;
      return {
        channelId: channel.channelId,
        name: channel.name,
        avatar: channel.avatar,
        agentIds: channel.agentIds,
        isMuted: channel.isMuted,
        lastMessage: channel.lastMessage,
        lastMessageSenderName,
        lastMessageTime: channel.lastMessageTime.toISOString(),
        createdAt: channel.createdAt.toISOString(),
      };
    });

    res.json({
      success: true,
      data: formattedChannels,
    });
  } catch (error) {
    console.error('Get channels error:', error);
    res.status(500).json({ success: false, message: '获取频道列表失败' });
  }
});

router.delete('/:channelId', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { channelId } = req.params as { channelId: string };

    const channel = await prisma.channel.findUnique({
      where: { channelId },
    });

    if (!channel) {
      res.status(404).json({ success: false, message: '频道不存在' });
      return;
    }

    if (channel.createdById !== userId) {
      res.status(403).json({ success: false, message: '无权删除此频道' });
      return;
    }

    // 先清理长期记忆（无关联约束，需手动删除）
    await prisma.channelMemory.deleteMany({ where: { channelId } });

    await prisma.channel.delete({
      where: { channelId },
    });

    res.json({
      success: true,
      message: '频道已删除',
    });
  } catch (error) {
    console.error('Delete channel error:', error);
    res.status(500).json({ success: false, message: '删除频道失败' });
  }
});

// DELETE /channels/:channelId/messages - 清空频道所有消息和长期记忆（相当于新群）
router.delete('/:channelId/messages', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { channelId } = req.params as { channelId: string };

    await prisma.message.deleteMany({ where: { channelId } });
    await prisma.channelMemory.deleteMany({ where: { channelId } });
    await prisma.channel.update({
      where: { channelId },
      data: { lastMessage: '', lastMessageTime: new Date() },
    });

    res.json({ success: true, message: '对话已清空' });
  } catch (error) {
    console.error('Clear messages error:', error);
    res.status(500).json({ success: false, message: '清空失败' });
  }
});

// GET /channels/:channelId/messages - 获取历史消息（最近 100 条）
router.get('/:channelId/messages', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { channelId } = req.params as { channelId: string };
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 200);
    const beforeCreatedAtRaw = typeof req.query.beforeCreatedAt === 'string'
      ? req.query.beforeCreatedAt
      : undefined;

    let beforeCreatedAt: Date | undefined;
    if (beforeCreatedAtRaw) {
      beforeCreatedAt = new Date(beforeCreatedAtRaw);
      if (Number.isNaN(beforeCreatedAt.getTime())) {
        res.status(400).json({ success: false, message: 'beforeCreatedAt 参数格式不正确' });
        return;
      }
    }

    const fetched = await prisma.message.findMany({
      where: {
        channelId,
        ...(beforeCreatedAt ? { createdAt: { lt: beforeCreatedAt } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    });

    const hasMore = fetched.length > limit;
    const messages = (hasMore ? fetched.slice(0, limit) : fetched).reverse();

    res.json({
      success: true,
      data: {
        messages: messages.map((m) => ({
          messageId: m.messageId,
          channelId: m.channelId,
          senderType: m.senderType,
          senderId: m.senderId,
          senderName: m.senderName,
          senderAvatar: m.senderAvatar,
          content: m.content,
          ragSources: (m as { ragSources?: string[] }).ragSources ?? [],
          createdAt: m.createdAt.toISOString(),
        })),
        hasMore,
      },
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ success: false, message: '获取消息失败' });
  }
});

// POST /channels/:channelId/confirm-plan - 持久化计划确认消息
router.post('/:channelId/confirm-plan', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { channelId } = req.params as { channelId: string };
    const { agentId, agentName, agentAvatar, content } = req.body as {
      agentId: string;
      agentName: string;
      agentAvatar?: string;
      content: string;
    };

    const msg = await prisma.message.create({
      data: {
        messageId: `MSG${nanoid(10)}`,
        channelId,
        senderType: 'confirm',
        senderId: agentId,
        senderName: agentName,
        senderAvatar: agentAvatar ?? null,
        content,
      },
    });

    res.json({ success: true, data: { messageId: msg.messageId } });
  } catch (err) {
    console.error('[Channel] POST confirm-plan error:', err);
    res.status(500).json({ success: false, message: '保存确认消息失败' });
  }
});

// POST /channels/:channelId/chat - 用户发送消息并触发 agent 流式回复（SSE）
router.post('/:channelId/chat', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.userId!;
  const { channelId } = req.params as { channelId: string };
  const { content, mentionedAgentIds = [], isPlanMode = false, libraryTag, enableWebSearch = false } = req.body as { content: string; mentionedAgentIds?: string[]; isPlanMode?: boolean; libraryTag?: string; enableWebSearch?: boolean };

  if (!content || !content.trim()) {
    res.status(400).json({ success: false, message: '消息内容不能为空' });
    return;
  }

  // 设置 SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const sendEvent = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const channel = await prisma.channel.findUnique({ where: { channelId } });
    if (!channel) {
      sendEvent('error', { message: '频道不存在' });
      res.end();
      return;
    }

    const user = await prisma.user.findUnique({ where: { userId } });
    if (!user) {
      sendEvent('error', { message: '用户不存在' });
      res.end();
      return;
    }

    // 保存用户消息
    const userMessage = await prisma.message.create({
      data: {
        messageId: `MSG${nanoid(10)}`,
        channelId,
        senderType: 'user',
        senderId: userId,
        senderName: user.username,
        senderAvatar: user.avatar,
        content: content.trim(),
      },
    });

    await prisma.channel.update({
      where: { channelId },
      data: { lastMessage: content.trim(), lastMessageTime: new Date() },
    });

    // 发送用户消息事件
    sendEvent('user_message', formatMessage(userMessage));

    const agents = await prisma.agent.findMany({
      where: { agentId: { in: channel.agentIds } },
    });

    const agentNames = agents.map((agent) => agent.name);
    const intentAnalysis = analyzeUserIntent(content.trim(), agentNames);
    const normalizedUserContent = intentAnalysis.normalizedContent || content.trim();

    if (agents.length === 0) {
      sendEvent('done', {});
      res.end();
      return;
    }

    // 按前端传入的 mentionedAgentIds 顺序确定被@的 agent（前端从 chip DOM 顺序提取，100% 准确）
    const mentionedAgents = mentionedAgentIds
      .map((id) => agents.find((a) => a.agentId === id))
      .filter((a): a is NonNullable<typeof a> => a != null);

    let replyAgents: typeof agents;
    const nonMentioned = agents.filter((a) => !mentionedAgents.find((m) => m.agentId === a.agentId));

    // 查询频道最后一条 agent/plan 消息（计划模式和普通模式都可能用到）
    const lastAgentMsg = await prisma.message.findFirst({
      where: { channelId, senderType: { in: ['agent', 'plan'] } },
      orderBy: { createdAt: 'desc' },
    });
    const lastActiveAgent = lastAgentMsg
      ? agents.find((a) => a.agentId === lastAgentMsg.senderId) ?? null
      : null;

    if (isPlanMode) {
      // 计划模式：只触发 1 个 agent，其他 agent 禁止参与
      if (mentionedAgents.length > 0) {
        replyAgents = [mentionedAgents[0]];
      } else if (lastActiveAgent) {
        replyAgents = [lastActiveAgent];
      } else {
        replyAgents = [agents[Math.floor(Math.random() * agents.length)]];
      }
    } else if (mentionedAgents.length === 0) {
      // 无 @mention：最后一条 agent 消息的发送者优先 + 随机 0-2 个其他 agent
      const primary = lastActiveAgent ?? agents[Math.floor(Math.random() * agents.length)];
      const others = agents.filter((a) => a.agentId !== primary.agentId);
      const shuffled = [...others].sort(() => Math.random() - 0.5);
      const extraCount = Math.min(others.length, Math.floor(Math.random() * 3)); // 0-2
      replyAgents = [primary, ...shuffled.slice(0, extraCount)];
    } else {
      // 有 @mention：被 @ 的按顺序在前 + 随机追加 0-1 个未被 @ 的
      const shuffled = [...nonMentioned].sort(() => Math.random() - 0.5);
      const extra = shuffled.slice(0, Math.floor(Math.random() * 2));
      replyAgents = [...mentionedAgents, ...extra];
    }

    const history = await prisma.message.findMany({
      where: { channelId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    history.reverse();

    const channelMemory = await getChannelMemory(channelId);

    // RAG 检索（循环外只做一次向量化+检索，结果供各 agent 作为“参考”）
    let ragChunks: Array<{ content: string; fileName: string; score: number }> = [];
    let ragHasResult = false;
    if (libraryTag) {
      try {
        const workspaceMember = await prisma.workspaceMember.findFirst({
          where: { userId },
          include: { workspace: true },
        });
        const workspaceId = workspaceMember?.workspace.workspaceId;
        if (workspaceId) {
          const vectorConfig = await prisma.modelProviderConfig.findFirst({
            where: { apiType: 'vector', isEnabled: true },
            orderBy: { createdAt: 'asc' },
          });
          if (vectorConfig) {
            const { decrypt } = await import('../lib/crypto.js');
            const apiKey = decrypt(vectorConfig.apiKey);
            const queryEmbeddings = await callDashScopeEmbeddingAPI(
              [{ text: normalizedUserContent }],
              { apiKey, modelName: vectorConfig.modelName },
              { modelCustomId: vectorConfig.customId, userId, userEmail: user.email, username: user.username },
            );
            const allChunks = await searchChunksByTag(queryEmbeddings[0], libraryTag, workspaceId);
            ragChunks = allChunks;
            ragHasResult = ragChunks.length > 0;
            console.log(`[RAG] tag=${libraryTag} total=${allChunks.length} used=${ragChunks.length} scores=${allChunks.map(c => c.score.toFixed(3)).join(',')}`);
          }
        }
      } catch (err) {
        console.error('[RAG] search failed:', err);
      }
    }

    // 历史消息原始列表（排除刚保存的用户消息）
    const historyMessages = history.filter((m) => m.messageId !== userMessage.messageId);

    const precedingAgentReplies: Array<{ name: string; content: string }> = [];

    for (const agent of replyAgents) {
      // 构建历史上下文（计划模式和普通模式共用）
      // 关键：只有当前 agent 自己的历史消息才是 assistant role
      // 其他 agent 的消息统一用 user role（带名字前缀），避免 LLM 把别人的话当成自己说的
      const agentContextMessages = [
        ...historyMessages.map((m) => {
          if (m.senderType === 'user') {
            return {
              role: 'user' as const,
              content: m.content,
              name: m.senderName.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, '_'),
            };
          }
          if (m.senderType === 'agent' && m.senderId === agent.agentId) {
            // 当前 agent 自己说的话 → assistant
            return {
              role: 'assistant' as const,
              content: m.content,
              name: m.senderName.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, '_'),
            };
          }
          // 其他 agent 或 plan 消息 → user role，带名字前缀让 LLM 知道是谁说的
          return {
            role: 'user' as const,
            content: m.senderType === 'plan'
              ? `[${m.senderName}的计划] ${m.content}`
              : `[${m.senderName}]: ${m.content}`,
            name: m.senderName.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, '_'),
          };
        }),
        {
          role: 'user' as const,
          content: normalizedUserContent,
          name: user.username.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, '_'),
        },
      ];

      const now = new Date();
      const timeStr = now.toLocaleString('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', weekday: 'short',
      });

      const tempMessageId = `STREAM_${agent.agentId}_${Date.now()}`;

      // 每个 agent 独立的 RAG 上下文
      const ragContext = ragHasResult
        ? ragChunks.map((c) => `- ${c.content}`).join('\n\n')
        : null;
      const ragSourceFileNames = ragHasResult
        ? (() => {
            const seen = new Set<string>();
            return ragChunks.map((c) => c.fileName).filter((n) => { if (seen.has(n)) return false; seen.add(n); return true; });
          })()
        : [];
      const priorRepliesSummary = precedingAgentReplies
        .slice(-2)
        .map((r, idx) => `${idx + 1}. ${r.name}：${r.content.slice(0, 180)}`)
        .join('\n');

      // ── 计划模式分支 ──────────────────────────────────────────
      if (isPlanMode) {
        const planSystemPrompt = [
          `你是「${agent.name}」，这个群聊里的一名远程协作成员。`,
          '',
          '【你的角色设定】',
          agent.prompt,
          channelMemory ? `\n【群聊长期记忆】\n${channelMemory}` : '',
          ragContext
            ? `\n【知识库参考资料（tag: ${libraryTag}）】\n以下片段仅供参考，不覆盖用户当前需求；若与当前问题无关请忽略：\n${ragContext}`
            : '',
          '',
          '你的职责是根据用户需求生成内容选题计划，严格 JSON 输出，不要额外文本。',
        ].filter(Boolean).join('\n');

        const planUserPrompt = `用户需求：${normalizedUserContent}\n\n请基于用户需求给出文章计划，满足：
- count：默认1篇，除非用户明确要求其他数量（最多10篇）
- plans：每篇包含：
  - title：10~30字的实际标题
  - summary：50~80字的内容概要，只写核心观点，不展开细节
  - prompt：给AI写作的完整提示词，包含标题、摘要要求、用户特殊要求
- 方向尽量多样：情感/场景/权威/实用/对比/口碑/人群细分/故事/痛点解决等
- summary 严格控制在 50~80 字，超出视为错误
- 严格JSON输出，格式：{"count":1,"plans":[{"title":"...","summary":"...","prompt":"..."}]}`;

        // 通知前端开始（计划模式，先出骨架图）
        const planCount = (() => {
          const m = content.match(/(\d+)\s*篇/);
          return m ? parseInt(m[1], 10) : 1;
        })();

        sendEvent('agent_start', {
          tempMessageId,
          agentId: agent.agentId,
          agentName: agent.name,
          avatar: agent.avatar ?? null,
          isOnlineSearch: enableWebSearch,
          isPlan: true,
          planCount,
        });

        // 用 planUserPrompt 替换最后一条 user 消息，确保字段约束生效
        const planMessages = [
          ...agentContextMessages.slice(0, -1),
          { role: 'user' as const, content: planUserPrompt },
        ];

        const planWebSearchExtraBody: Record<string, unknown> | undefined = enableWebSearch
          ? { enable_search: true }
          : undefined;

        let planJson = '';
        try {
          const planStartMs = Date.now();
          let planResult: LLMResult | null = null;
          let planModelCustomId = agent.modelId ?? '';
          if (agent.modelId) {
            planResult = await callLLM(agent.modelId, planMessages, planSystemPrompt, planWebSearchExtraBody);
          } else {
            const fallbackConfig = await prisma.modelProviderConfig.findFirst({
              where: { apiType: 'llm', isEnabled: true },
            });
            if (fallbackConfig) {
              planModelCustomId = fallbackConfig.customId;
              const conf = await getConfigByCustomId(fallbackConfig.customId);
              if (conf) {
                planResult = await callLLMWithConfig(conf, planMessages, planSystemPrompt, planWebSearchExtraBody);
              }
            }
          }
          if (planResult) {
            planJson = planResult.content;
            prisma.apiCallLog.create({
              data: {
                modelCustomId: planModelCustomId,
                apiType: 'llm',
                callType: 'plan',
                userId,
                userEmail: user.email,
                username: user.username,
                channelId,
                promptTokens: planResult.usage.promptTokens,
                completionTokens: planResult.usage.completionTokens,
                totalTokens: planResult.usage.totalTokens,
                durationMs: Date.now() - planStartMs,
                isSuccess: true,
              },
            }).catch((e: unknown) => console.error('[ApiCallLog] write failed:', e));
          }
        } catch (err) {
          console.error(`Plan LLM failed for agent ${agent.agentId}:`, err);
          prisma.apiCallLog.create({
            data: {
              modelCustomId: agent.modelId ?? 'unknown',
              apiType: 'llm',
              callType: 'plan',
              userId,
              userEmail: user.email,
              username: user.username,
              channelId,
              durationMs: 0,
              isSuccess: false,
              errorMessage: err instanceof Error ? err.message : String(err),
            },
          }).catch((e: unknown) => console.error('[ApiCallLog] write failed:', e));
        }

        if (!planJson) {
          sendEvent('agent_end', { tempMessageId, cancelled: true });
          continue;
        }

        // 提取 JSON（兼容 LLM 可能包裹在 ```json ... ``` 里的情况）
        const jsonMatch = planJson.match(/```json\s*([\s\S]*?)```/) ?? planJson.match(/(\{[\s\S]*\})/);
        const cleanJson = jsonMatch ? (jsonMatch[1] ?? jsonMatch[0]) : planJson;

        // 验证 JSON 合法性，并对 summary 做硬截断
        let finalJson = cleanJson;
        try {
          const parsed = JSON.parse(cleanJson) as {
            count: number;
            plans: Array<{ title: string; summary: string; prompt: string }>;
          };
          if (Array.isArray(parsed.plans)) {
            parsed.plans = parsed.plans.map((p) => ({
              ...p,
              summary: p.summary.length > 100 ? p.summary.slice(0, 99) + '…' : p.summary,
            }));
          }
          finalJson = JSON.stringify(parsed);
        } catch {
          sendEvent('agent_end', { tempMessageId, cancelled: true });
          continue;
        }

        // 保存到数据库（senderType='plan'）
        const planMsg = await prisma.message.create({
          data: {
            messageId: `MSG${nanoid(10)}`,
            channelId,
            senderType: 'plan',
            senderId: agent.agentId,
            senderName: agent.name,
            senderAvatar: agent.avatar,
            content: finalJson,
            ...(ragSourceFileNames.length > 0 ? { ragSources: ragSourceFileNames } : {}),
          },
        });

        await prisma.channel.update({
          where: { channelId },
          data: { lastMessage: '[计划]', lastMessageTime: new Date() },
        });

        if (ragSourceFileNames.length > 0) {
          sendEvent('rag_sources', { tempMessageId, fileNames: ragSourceFileNames });
        }
        sendEvent('agent_end', { tempMessageId, message: formatMessage(planMsg) });
        continue;
      }

      // ── 普通聊天模式 ──────────────────────────────────────────
      const teammates = agents
        .filter((a) => a.agentId !== agent.agentId)
        .map((a) => a.name)
        .join('、');

      const systemPrompt = [
        // 第一层：全局设定
        `你是「${agent.name}」，这个群聊里的一名远程协作成员。`,
        '群里有用户（老板/同事）和其他 AI 成员，大家通过文字消息异步沟通。',
        '',
        `当前时间：${timeStr}`,
        `群内其他成员：${teammates || '暂无'}`,
        `发消息的用户：${user.username}`,
        '',
        // 第二层：角色设定（来自 admin 后台 prompt 字段）
        '【你的角色设定】',
        agent.prompt,
        '',
        // 第三层：动态上下文
        channelMemory ? `【群聊长期记忆】\n${channelMemory}` : '',
        `【用户意图预分析】\n- 原始输入：${intentAnalysis.originalContent}\n- 去除@提及后的核心问题：${normalizedUserContent}\n- 意图类型：${intentAnalysis.intentType}\n- 置信度：${intentAnalysis.confidence}`,
        ragContext
          ? `【知识库参考】\n以下是从知识库检索到的相关内容，请结合你的角色设定按需引用，无关则忽略：\n${ragContext}`
          : '',
        precedingAgentReplies.length > 0
          ? `【本轮同事已发言】\n${priorRepliesSummary}\n不要重复他们说过的内容，从你自己的角度补充或互动。`
          : '',
        '',
        // 行为底线
        '【行为底线（必须遵守）】',
        '1. 无论角色设定是什么语言，始终用中文回复。',
        '2. 像正常人在群里发消息一样回复，语气自然，长短随意。',
        '3. 绝对不要说"我现在去写/做/执行 xxx"、"今晚/明天输出 xxx"等你根本无法执行的承诺。你只能通过这个聊天窗口输出文字。',
        '4. 如果用户问的内容超出你的知识范围，直接说不太了解，不要编造。',
        '5. 禁止输出动作、心情、表情等状态描述（例如“（思考）”“（叹气）”“我有点紧张了”“😊”）；只输出可直接发送给用户的正文。',
        '6. 不要重复自我介绍，除非被明确询问。',
        '7. 可以对同事的发言做出反应（认同、质疑、追问、补充），像真实群聊一样。',
        '8. 引用知识库内容时，不要在句尾或段落里添加类似 [1]、[2]、[3] 的编号标记。',
        '9. 严禁描述或评论其他成员的行为状态，例如"莉莉没回"、"小美没说话"、"xx在忙"等。你只能说自己想说的话，不要替别人发言或描述别人。',
        '10. 用户输入中的 @提及 仅代表点名对象，不属于问题语义本身。回答时以“去除@提及后的核心问题”为准。',
      ].filter(Boolean).join('\n');

      // 普通模式：先发送 agent_start，让前端立即展示该 Agent 的 loading 状态
      sendEvent('agent_start', {
        tempMessageId,
        agentId: agent.agentId,
        agentName: agent.name,
        avatar: agent.avatar ?? null,
        isOnlineSearch: enableWebSearch,
      });

      // 先用非流式接口获取完整内容，后处理通过后再发 agent_start + token（模拟流式逐字输出）
      const webSearchExtraBody: Record<string, unknown> | undefined = enableWebSearch
        ? { enable_search: true }
        : undefined;

      let replyContent = '';
      try {
        const chatStartMs = Date.now();
        let chatResult: LLMResult | null = null;
        let chatModelCustomId = agent.modelId ?? '';
        if (agent.modelId) {
          chatResult = await callLLM(agent.modelId, agentContextMessages, systemPrompt, webSearchExtraBody);
        } else {
          const fallbackConfig = await prisma.modelProviderConfig.findFirst({
            where: { apiType: 'llm', isEnabled: true },
          });
          if (fallbackConfig) {
            chatModelCustomId = fallbackConfig.customId;
            const conf = await getConfigByCustomId(fallbackConfig.customId);
            if (conf) {
              chatResult = await callLLMWithConfig(conf, agentContextMessages, systemPrompt, webSearchExtraBody);
            }
          }
        }
        if (chatResult) {
          replyContent = chatResult.content;
          prisma.apiCallLog.create({
            data: {
              modelCustomId: chatModelCustomId,
              apiType: 'llm',
              callType: 'chat',
              userId,
              userEmail: user.email,
              username: user.username,
              channelId,
              promptTokens: chatResult.usage.promptTokens,
              completionTokens: chatResult.usage.completionTokens,
              totalTokens: chatResult.usage.totalTokens,
              durationMs: Date.now() - chatStartMs,
              isSuccess: true,
            },
          }).catch((e: unknown) => console.error('[ApiCallLog] write failed:', e));
        }
      } catch (err) {
        console.error(`LLM call failed for agent ${agent.agentId}:`, err);
        replyContent = '暂时无法回复，请稍后再试';
        prisma.apiCallLog.create({
          data: {
            modelCustomId: agent.modelId ?? 'unknown',
            apiType: 'llm',
            callType: 'chat',
            userId,
            userEmail: user.email,
            username: user.username,
            channelId,
            durationMs: 0,
            isSuccess: false,
            errorMessage: err instanceof Error ? err.message : String(err),
          },
        }).catch((e: unknown) => console.error('[ApiCallLog] write failed:', e));
      }

      if (!replyContent) {
        sendEvent('agent_end', { tempMessageId, cancelled: true });
        continue;
      }

      // 不做输出后处理，确保“模型输出 = 前端展示 = 入库上下文”一致
      replyContent = replyContent.trim();

      if (!replyContent) {
        sendEvent('agent_end', { tempMessageId, cancelled: true });
        continue;
      }

      // 直接按模型输出内容逐 token 下发（模拟流式逐字输出）
      for (const char of replyContent) {
        sendEvent('token', { tempMessageId, token: char });
      }

      const agentMsg = await prisma.message.create({
        data: {
          messageId: `MSG${nanoid(10)}`,
          channelId,
          senderType: 'agent',
          senderId: agent.agentId,
          senderName: agent.name,
          senderAvatar: agent.avatar,
          content: replyContent,
          ...(ragSourceFileNames.length > 0 ? { ragSources: ragSourceFileNames } : {}),
        },
      });

      await prisma.channel.update({
        where: { channelId },
        data: { lastMessage: replyContent, lastMessageTime: new Date() },
      });

      if (ragSourceFileNames.length > 0) {
        sendEvent('rag_sources', { tempMessageId, fileNames: ragSourceFileNames });
      }
      sendEvent('agent_end', { tempMessageId, message: formatMessage(agentMsg) });

      precedingAgentReplies.push({ name: agent.name, content: replyContent });
    }

    sendEvent('done', {});
    res.end();

    triggerMemoryUpdate(channelId);
  } catch (error) {
    console.error('Chat SSE error:', error);
    try {
      res.write(`event: error\ndata: ${JSON.stringify({ message: '发送消息失败' })}\n\n`);
      res.end();
    } catch { /* 连接已关闭 */ }
  }
});

function normalizeForCompare(input: string): string {
  return input
    .replace(/\s+/g, ' ')
    .replace(/[，。！？、,.!?:;；：]/g, '')
    .trim()
    .toLowerCase();
}

function formatMessage(m: {
  messageId: string;
  channelId: string;
  senderType: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  content: string;
  ragSources?: string[];
  createdAt: Date;
}) {
  return {
    messageId: m.messageId,
    channelId: m.channelId,
    senderType: m.senderType,
    senderId: m.senderId,
    senderName: m.senderName,
    senderAvatar: m.senderAvatar,
    content: m.content,
    ragSources: m.ragSources ?? [],
    createdAt: m.createdAt.toISOString(),
  };
}

export default router;
