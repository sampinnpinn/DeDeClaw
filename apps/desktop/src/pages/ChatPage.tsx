import { useState, useEffect, useCallback, useRef } from 'react';
import { mutate as swrMutate } from 'swr';
import ConversationList from '../components/ConversationList';
import ChatPanel from '../components/ChatPanel';
import CreateChannelModal from '../components/CreateChannelModal';
import ChannelSettingsModal from '../components/ChannelSettingsModal';
import AddMemberModal from '../components/AddMemberModal';
import { Conversation, Message } from '../mockData';
import { agentHireService } from '../services/agentHireService';
import { channelService } from '../services/channelService';
import { authService } from '../services/authService';
import { assetsService } from '../services/assetsService';
import { useAuth } from '../contexts/AuthContext';
import type { Agent } from '@/shared/types/agent';
import type { ChannelData as ChannelApiData, ChannelMessageData } from '../shared/types/channel';
import { getRandomChannelAvatarUrl } from '../shared/constants/channelAvatar';

const INITIAL_MESSAGE_LIMIT = 10;
const HISTORY_PAGE_SIZE = 15;

// 将 API 返回的消息格式转换为 Message 类型
function normalizeAvatar(avatar: string | null | undefined): string | undefined {
  if (!avatar) return undefined;
  // Vite public 目录下的文件直接用 /xxx.webp 访问，不需要 /public/ 前缀
  // 如果存的是 /public/xxx.webp 则去掉多余前缀
  if (avatar.startsWith('/public/')) {
    return avatar.slice('/public'.length);
  }
  return avatar;
}

function apiMsgToMessage(m: Record<string, unknown>, currentUserId: string): Message {
  const isUser = m.senderType === 'user';
  const isPlan = m.senderType === 'plan';
  const isConfirm = m.senderType === 'confirm';
  const ragSources = Array.isArray(m.ragSources)
    ? (m.ragSources.filter((s): s is string => typeof s === 'string'))
    : [];

  let planMetadata: Message['metadata'] | undefined;
  if (isPlan) {
    try {
      const parsed = JSON.parse(m.content as string) as {
        count: number;
        plans: Array<{ title: string; summary: string; prompt: string }>;
      };
      planMetadata = { plans: parsed.plans, planCount: parsed.count };
    } catch {
      planMetadata = { planCount: 1 };
    }
  }

  const messageMetadata: Message['metadata'] | undefined =
    isConfirm
      ? { viewTaskProgress: true }
      : planMetadata || ragSources.length > 0
      ? {
          ...(planMetadata ?? {}),
          ...(ragSources.length > 0 ? { ragSources } : {}),
        }
      : undefined;

  return {
    id: m.messageId as string,
    conversationId: m.channelId as string,
    ...(isUser
      ? { userId: m.senderId as string, userName: m.senderName as string }
      : { agentId: m.senderId as string, agentName: m.senderName as string }),
    avatar: normalizeAvatar(m.senderAvatar as string | null),
    content: m.content as string,
    type: isPlan ? 'dede_plan' : 'text',
    metadata: messageMetadata,
    isSelf: isUser && (currentUserId ? m.senderId === currentUserId : true),
    createdAt: new Date(m.createdAt as string),
  };
}

interface ChatPageProps {
  onGoToAssets?: () => void;
  pendingOpenChannel?: ChannelApiData | null;
  onPendingOpenChannelHandled?: () => void;
}

interface ChannelHistoryState {
  hasMore: boolean;
  isLoading: boolean;
  oldestCreatedAt?: string;
}

type ConversationUpdater = (conversation: Conversation) => Conversation;

function applyRecentConversationUpdate(
  conversations: Conversation[],
  channelId: string,
  updateConversation: ConversationUpdater,
): Conversation[] {
  const targetConversation = conversations.find((conversation) => conversation.id === channelId);
  if (!targetConversation) {
    return conversations;
  }

  const updatedConversation = updateConversation(targetConversation);
  if (updatedConversation.isPinned) {
    return conversations.map((conversation) =>
      conversation.id === channelId ? updatedConversation : conversation,
    );
  }

  const remainingConversations = conversations.filter((conversation) => conversation.id !== channelId);
  const pinnedConversations = remainingConversations.filter((conversation) => conversation.isPinned);
  const unpinnedConversations = remainingConversations.filter((conversation) => !conversation.isPinned);

  return [...pinnedConversations, updatedConversation, ...unpinnedConversations];
}

function mapChannelToConversation(channel: ChannelApiData, defaultChannelAvatar: string): Conversation {
  return {
    id: channel.channelId,
    name: channel.name,
    avatar: normalizeAvatar(channel.avatar) || defaultChannelAvatar,
    lastMessage: channel.lastMessage || '',
    lastMessageSenderName: channel.lastMessageSenderName || undefined,
    isMuted: channel.isMuted,
    lastMessageTime: new Date(channel.lastMessageTime),
    unreadCount: 0,
    type: 'group',
    memberCount: channel.agentIds.length,
    members: channel.agentIds,
    isSingleTalentChannel: channel.agentIds.length === 1,
  };
}

function ChatPage({ onGoToAssets, pendingOpenChannel, onPendingOpenChannelHandled }: ChatPageProps) {
  const defaultChannelAvatar = `${import.meta.env.BASE_URL}dede.webp`;
  const [selectedConversationId, setSelectedConversationId] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [historyStateByChannel, setHistoryStateByChannel] = useState<Record<string, ChannelHistoryState>>({});
  const [isCreateChannelOpen, setIsCreateChannelOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [hiredAgents, setHiredAgents] = useState<Agent[]>([]);
  const [isSending, setIsSending] = useState(false);
  // 每个频道独立的侧栏开启状态 { [channelId]: boolean }
  const [memberPanelStates, setMemberPanelStates] = useState<Record<string, boolean>>({});
  // 每个频道独立的知识库 tag { [channelId]: string }
  const [libraryTagByChannel, setLibraryTagByChannel] = useState<Record<string, string>>({});
  // 用 ref 持有最新的 selectedConversationId，供 SSE 回调闭包读取
  const selectedConversationIdRef = useRef(selectedConversationId);

  const { user: authUser } = useAuth();
  // 优先用 AuthContext 里的 user（登录后立即可用），降级到 localStorage
  const currentUserId = authUser?.userId ?? authService.getUserId() ?? '';

  // 未读消息计数 { [channelId]: number }，用 localStorage 持久化（按用户 id 隔离）
  const unreadStorageKey = `unread_counts_${currentUserId || 'guest'}`;
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>(() => {
    try {
      const stored = localStorage.getItem(`unread_counts_${authService.getUserId() || 'guest'}`);
      return stored ? (JSON.parse(stored) as Record<string, number>) : {};
    } catch {
      return {};
    }
  });

  // 加载指定频道的历史消息
  const loadMessages = useCallback(async (channelId: string) => {
    if (!channelId.startsWith('CH')) return; // mock 频道不加载
    setHistoryStateByChannel((prev) => ({
      ...prev,
      [channelId]: {
        hasMore: prev[channelId]?.hasMore ?? true,
        oldestCreatedAt: prev[channelId]?.oldestCreatedAt,
        isLoading: true,
      },
    }));
    try {
      const res = await channelService.getMessages(channelId, { limit: INITIAL_MESSAGE_LIMIT });
      if (res.success && res.data) {
        const fetchedMessages = res.data.messages;
        const msgs: Message[] = fetchedMessages.map((m: ChannelMessageData) =>
          apiMsgToMessage(m as unknown as Record<string, unknown>, currentUserId)
        );
        setMessages(prev => ({ ...prev, [channelId]: msgs }));
        setHistoryStateByChannel((prev) => ({
          ...prev,
          [channelId]: {
            hasMore: res.data?.hasMore ?? false,
            oldestCreatedAt: fetchedMessages[0]?.createdAt,
            isLoading: false,
          },
        }));
        return;
      }
    } catch (error) {
      console.error('Load messages error:', error);
    }

    setHistoryStateByChannel((prev) => ({
      ...prev,
      [channelId]: {
        hasMore: false,
        oldestCreatedAt: prev[channelId]?.oldestCreatedAt,
        isLoading: false,
      },
    }));
  }, [currentUserId]);

  const loadMoreHistory = useCallback(async (channelId: string) => {
    if (!channelId.startsWith('CH')) return;

    const currentState = historyStateByChannel[channelId] ?? { hasMore: false, isLoading: false };
    if (currentState.isLoading || !currentState.hasMore || !currentState.oldestCreatedAt) {
      return;
    }

    const beforeCreatedAt = currentState.oldestCreatedAt;
    setHistoryStateByChannel((prev) => ({
      ...prev,
      [channelId]: {
        ...currentState,
        isLoading: true,
      },
    }));

    try {
      const res = await channelService.getMessages(channelId, {
        limit: HISTORY_PAGE_SIZE,
        beforeCreatedAt,
      });

      if (res.success && res.data) {
        const fetchedMessages = res.data.messages;
        const olderMessages = fetchedMessages.map((m: ChannelMessageData) =>
          apiMsgToMessage(m as unknown as Record<string, unknown>, currentUserId)
        );

        setMessages((prev) => {
          const currentMessages = prev[channelId] ?? [];
          const existingIds = new Set(currentMessages.map((item) => item.id));
          const mergedOlderMessages = olderMessages.filter((item) => !existingIds.has(item.id));
          return {
            ...prev,
            [channelId]: [...mergedOlderMessages, ...currentMessages],
          };
        });

        setHistoryStateByChannel((prev) => {
          const currentState = prev[channelId] ?? { hasMore: false, isLoading: false };
          return {
            ...prev,
            [channelId]: {
              hasMore: res.data?.hasMore ?? false,
              oldestCreatedAt: fetchedMessages[0]?.createdAt ?? currentState.oldestCreatedAt,
              isLoading: false,
            },
          };
        });
        return;
      }
    } catch (error) {
      console.error('Load more history error:', error);
    }

    setHistoryStateByChannel((prev) => {
      const currentState = prev[channelId] ?? { hasMore: false, isLoading: false };
      return {
        ...prev,
        [channelId]: {
          ...currentState,
          isLoading: false,
        },
      };
    });
  }, [currentUserId, historyStateByChannel]);

  const loadHiredAgents = useCallback(async () => {
    const agentsRes = await agentHireService.getMyAgents();
    if (agentsRes.success) {
      setHiredAgents(agentsRes.data);
    }
  }, []);

  useEffect(() => {
    Promise.all([
      loadHiredAgents(),
      channelService.getChannels(),
    ]).then(([, channelsRes]) => {
      if (channelsRes.success && channelsRes.data) {
        const dbChannels: Conversation[] = channelsRes.data.map((ch: ChannelApiData) => mapChannelToConversation(ch, defaultChannelAvatar));
        const firstId = dbChannels[0]?.id || '';
        setConversations(dbChannels);
        setSelectedConversationId((prev) => prev || firstId);
      }
    });
  }, [defaultChannelAvatar, loadHiredAgents]);

  useEffect(() => {
    if (!pendingOpenChannel) {
      return;
    }

    const targetConversation = mapChannelToConversation(pendingOpenChannel, defaultChannelAvatar);
    setConversations((prev) => {
      const existingIndex = prev.findIndex((item) => item.id === targetConversation.id);
      if (existingIndex >= 0) {
        return prev.map((item) => (item.id === targetConversation.id ? { ...item, ...targetConversation, isPinned: item.isPinned } : item));
      }

      const pinned = prev.filter((item) => item.isPinned);
      const unpinned = prev.filter((item) => !item.isPinned);
      return [...pinned, targetConversation, ...unpinned];
    });
    setSelectedConversationId(targetConversation.id);
    setUnreadCounts((prev) => ({ ...prev, [targetConversation.id]: 0 }));
    onPendingOpenChannelHandled?.();
  }, [defaultChannelAvatar, onPendingOpenChannelHandled, pendingOpenChannel]);

  const handleOpenCreateChannel = async () => {
    await loadHiredAgents();
    setIsCreateChannelOpen(true);
  };

  const handleOpenAddMember = async () => {
    if (currentConversation?.isSingleTalentChannel) {
      return;
    }
    await loadHiredAgents();
    setIsAddMemberOpen(true);
  };

  // 同步 ref，供 SSE 回调闭包读取最新值
  useEffect(() => {
    selectedConversationIdRef.current = selectedConversationId;
  }, [selectedConversationId]);

  // unreadCounts 变化时写入 localStorage
  useEffect(() => {
    try {
      localStorage.setItem(unreadStorageKey, JSON.stringify(unreadCounts));
    } catch { /* 忽略存储错误 */ }
  }, [unreadCounts, unreadStorageKey]);

  // 切换频道时加载消息
  useEffect(() => {
    if (!selectedConversationId) {
      return;
    }

    if (messages[selectedConversationId] !== undefined) {
      return;
    }

    loadMessages(selectedConversationId);
  }, [loadMessages, messages, selectedConversationId]);

  const handleCreateChannel = async (selectedAgents: Agent[]) => {
    const names = selectedAgents.map(a => a.name);
    const channelName = names.length > 3
      ? `${names.slice(0, 3).join('、')}…`
      : names.join('、');

    const agentIds = selectedAgents.map(a => a.agentId);
    const randomAvatar = getRandomChannelAvatarUrl();
    const result = await channelService.createChannel(agentIds, channelName, randomAvatar ?? undefined);

    if (result.success && result.data) {
      const newChannel = mapChannelToConversation(result.data, defaultChannelAvatar);

      const pinned = conversations.filter(c => c.isPinned);
      const unpinned = conversations.filter(c => !c.isPinned);
      setConversations([...pinned, newChannel, ...unpinned]);
      setSelectedConversationId(newChannel.id);
    }
  };

  const handleUpdateChannel = (channelId: string, data: { name?: string; avatar?: string; isMuted?: boolean }) => {
    setConversations(conversations.map(c => 
      c.id === channelId ? { ...c, ...data } : c
    ));
  };

  const handleDeleteChannel = (channelId: string) => {
    setConversations((prev) => {
      const nextConversations = prev.filter((item) => item.id !== channelId);
      if (selectedConversationId === channelId) {
        setSelectedConversationId(nextConversations[0]?.id || '');
      }
      return nextConversations;
    });
    setMessages((prev) => {
      const { [channelId]: _target, ...rest } = prev;
      return rest;
    });
    setHistoryStateByChannel((prev) => {
      const { [channelId]: _target, ...rest } = prev;
      return rest;
    });
  };

  const handleOpenSettings = () => {
    if (currentConversation?.id.startsWith('CH')) {
      setIsSettingsOpen(true);
    }
  };

  const handleToggleMemberPanel = () => {
    if (!currentConversation) return;
    const id = currentConversation.id;
    setMemberPanelStates(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handlePinChannel = () => {
    if (!currentConversation) return;
    const id = currentConversation.id;
    setConversations(prev => {
      const target = prev.find(c => c.id === id);
      if (!target) return prev;
      const rest = prev.filter(c => c.id !== id);
      const pinnedOthers = rest.filter(c => c.isPinned);
      const unpinned = rest.filter(c => !c.isPinned);
      return [...pinnedOthers, { ...target, isPinned: true }, ...unpinned];
    });
  };

  const handleUnpinChannel = () => {
    if (!currentConversation) return;
    const id = currentConversation.id;
    setConversations(prev => {
      const target = prev.find(c => c.id === id);
      if (!target) return prev;
      const rest = prev.filter(c => c.id !== id);
      const pinned = rest.filter(c => c.isPinned);
      const unpinned = rest.filter(c => !c.isPinned);
      return [...pinned, { ...target, isPinned: false }, ...unpinned];
    });
  };

  const handleAddMember = async (newAgentIds: string[]) => {
    if (!currentConversation || currentConversation.isSingleTalentChannel || newAgentIds.length === 0) return;
    const result = await channelService.addMembers(currentConversation.id, newAgentIds);
    if (result.success && result.data) {
      const memberData = result.data;
      setConversations(conversations.map(c =>
        c.id === currentConversation.id
          ? { ...c, members: memberData.agentIds, memberCount: memberData.agentIds.length }
          : c
      ));
    }
  };

  const handleRemoveMember = async (agentId: string) => {
    if (!currentConversation || currentConversation.isSingleTalentChannel) return;
    const result = await channelService.removeMember(currentConversation.id, agentId);
    if (result.success && result.data) {
      const memberData = result.data;
      setConversations(conversations.map(c =>
        c.id === currentConversation.id
          ? { ...c, members: memberData.agentIds, memberCount: memberData.agentIds.length }
          : c
      ));
    }
  };

  const handleClearMessages = async () => {
    if (!currentConversation?.id.startsWith('CH')) return;
    const channelId = currentConversation.id;
    const result = await channelService.clearMessages(channelId);
    if (result.success) {
      setMessages(prev => ({ ...prev, [channelId]: [] }));
      setHistoryStateByChannel((prev) => ({
        ...prev,
        [channelId]: {
          hasMore: false,
          isLoading: false,
        },
      }));
      setConversations(prev => prev.map(c =>
        c.id === channelId ? { ...c, lastMessage: '', lastMessageSenderName: undefined } : c
      ));
    }
  };

  const handleConfirmPlan = async (messageId: string, contentTypes: string[]) => {
    const channelId = selectedConversationIdRef.current;
    // 把对应计划消息标记为已确认
    setMessages(prev => ({
      ...prev,
      [channelId]: (prev[channelId] ?? []).map(m =>
        m.id === messageId
          ? { ...m, metadata: { ...m.metadata, confirmed: true, contentTypes } }
          : m
      ),
    }));
    // 找到该消息，获取 agent 信息和计划列表
    const planMsg = (messages[channelId] ?? []).find(m => m.id === messageId);
    const agentName = planMsg?.agentName ?? 'DeDe';
    const agentAvatar = planMsg?.avatar;
    const agentId = planMsg?.agentId ?? '__plan__';
    const plans = planMsg?.metadata?.plans ?? [];
    const activeLibraryTag = libraryTagByChannel[channelId] ?? undefined;

    // 仅处理文章类型（暂时只考虑文章）
    const isArticle = contentTypes.includes('文章');
    const articlePlans = isArticle ? plans : [];
    const count = articlePlans.length || (planMsg?.metadata?.planCount ?? 1);
    const typeLabel = contentTypes.join('、');

    // 插入静态确认消息（乐观更新，同时持久化到数据库）
    const confirmContent = `好的，${agentName} 正在为你创建 ${count} 篇${typeLabel}。\n任务完成后，你可以前往「资产」页面查看生成内容。`;
    const confirmMsg: Message = {
      id: `CONFIRM_${messageId}`,
      conversationId: channelId,
      agentId,
      agentName,
      avatar: agentAvatar,
      content: confirmContent,
      type: 'text',
      isSelf: false,
      metadata: { viewTaskProgress: true } as Message['metadata'],
      createdAt: new Date(),
    };
    setMessages(prev => ({
      ...prev,
      [channelId]: [...(prev[channelId] ?? []), confirmMsg],
    }));
    // 持久化确认消息，重启后可恢复
    channelService.saveConfirmMessage(channelId, {
      agentId,
      agentName,
      agentAvatar,
      content: confirmContent,
    }).catch((err: unknown) => console.error('[ChatPage] saveConfirmMessage error:', err));

    // 触发文章生成
    if (isArticle && articlePlans.length > 0 && agentId !== '__plan__') {
      for (const plan of articlePlans) {
        try {
          const asset = await assetsService.createItem({ title: plan.title, assetType: '文章' });
          // 先触发生成（后端同步写 generating 状态到 DB），再刷新 SWR 缓存
          await assetsService.generateArticle({
            assetId: asset.assetId,
            agentId,
            title: plan.title,
            summary: plan.summary ?? '',
            libraryTag: activeLibraryTag,
          });
          // 此时后端已同步写入 generating 状态，刷新缓存后进度条立即可见
          await swrMutate('assets/items');
        } catch (err) {
          console.error('[ChatPage] generateArticle error:', err);
        }
      }
    }
  };

  const handleSendMessage = async (content: string, mentionedAgentIds: string[] = [], isPlanMode = false, libraryTag?: string, enableWebSearch?: boolean) => {
    if (!currentConversation || !content.trim() || isSending) return;
    if (!currentConversation.id.startsWith('CH')) return;

    const channelId = currentConversation.id;
    setIsSending(true);

    const TEMP_USER_ID = '__temp_user__';

    // 立即显示临时用户消息
    const tempUserMsg: Message = {
      id: TEMP_USER_ID,
      conversationId: channelId,
      userId: currentUserId,
      userName: authService.getUsername() ?? '我',
      content,
      type: 'text',
      isSelf: true,
      createdAt: new Date(),
    };
    setMessages(prev => ({
      ...prev,
      [channelId]: [
        ...(prev[channelId] ?? []).filter(m => m.id !== TEMP_USER_ID),
        tempUserMsg,
      ],
    }));
    setConversations((prev) =>
      applyRecentConversationUpdate(prev, channelId, (conversation) => ({
        ...conversation,
        lastMessage: content,
        lastMessageTime: new Date(),
        lastMessageSenderName: undefined,
      })),
    );

    try {
      await channelService.sendChatStream(channelId, content, mentionedAgentIds, isPlanMode, {
        onUserMessage: (msg) => {
          // 用真实用户消息替换临时消息
          const realUserMsg = apiMsgToMessage(msg, currentUserId);
          setMessages(prev => ({
            ...prev,
            [channelId]: (prev[channelId] ?? []).map(m => m.id === TEMP_USER_ID ? realUserMsg : m),
          }));
        },

        onAgentStart: ({ tempMessageId, agentId, agentName, avatar, isPlan, planCount, isOnlineSearch }) => {
          const loadingMetadata: Message['metadata'] | undefined = isPlan
            ? undefined
            : {
                loadingText: isOnlineSearch ? '正在联网搜索中' : '正在思考中',
                isOnlineSearch: Boolean(isOnlineSearch),
              };

          const streamMsg: Message = {
            id: tempMessageId,
            conversationId: channelId,
            agentId,
            agentName,
            avatar: normalizeAvatar(avatar),
            content: '',
            type: isPlan ? 'dede_plan' : 'text',
            isSelf: false,
            metadata: isPlan ? { planCount: planCount ?? 1 } : loadingMetadata,
            createdAt: new Date(),
          };
          setMessages(prev => ({
            ...prev,
            [channelId]: [...(prev[channelId] ?? []), streamMsg],
          }));
        },

        onToken: (tempMessageId, token) => {
          // 逐 token 追加到对应消息
          setMessages(prev => ({
            ...prev,
            [channelId]: (prev[channelId] ?? []).map(m =>
              m.id === tempMessageId ? { ...m, content: m.content + token } : m
            ),
          }));
        },

        onRagSources: (tempMessageId, fileNames) => {
          setMessages(prev => ({
            ...prev,
            [channelId]: (prev[channelId] ?? []).map(m =>
              m.id === tempMessageId ? { ...m, metadata: { ...m.metadata, ragSources: fileNames } } : m
            ),
          }));
        },

        onAgentEnd: (tempMessageId, message) => {
          if (!message) {
            // 先把内容清空，300ms 后再移除，避免已流式显示的气泡突然闪烁消失
            setMessages(prev => ({
              ...prev,
              [channelId]: (prev[channelId] ?? []).map(m =>
                m.id === tempMessageId ? { ...m, content: '' } : m
              ),
            }));
            setTimeout(() => {
              setMessages(prev => ({
                ...prev,
                [channelId]: (prev[channelId] ?? []).filter(m => m.id !== tempMessageId),
              }));
            }, 300);
            return;
          }
          // 计划消息：senderType === 'plan'，content 是 JSON
          if (message.senderType === 'plan') {
            let plans: Message['metadata'] = {};
            try {
              const parsed = JSON.parse(message.content as string) as {
                count: number;
                plans: Array<{ title: string; summary: string; prompt: string }>;
              };
              plans = { plans: parsed.plans, planCount: parsed.count };
            } catch {
              plans = { planCount: 1 };
            }
            setMessages(prev => ({
              ...prev,
              [channelId]: (prev[channelId] ?? []).map(m => {
                if (m.id !== tempMessageId) return m;
                const ragSources = m.metadata?.ragSources;
                return {
                  ...m,
                  id: message.messageId as string,
                  type: 'dede_plan' as const,
                  content: message.content as string,
                  metadata: { ...m.metadata, ...plans, ...(ragSources ? { ragSources } : {}) },
                };
              }),
            }));
            setConversations((prev) =>
              applyRecentConversationUpdate(prev, channelId, (conversation) => ({
                ...conversation,
                lastMessage: '[计划]',
                lastMessageTime: new Date(message.createdAt as string),
                lastMessageSenderName: message.senderName as string,
              })),
            );
            if (selectedConversationIdRef.current !== channelId) {
              setUnreadCounts(prev => ({ ...prev, [channelId]: (prev[channelId] ?? 0) + 1 }));
            }
            return;
          }
          const finalMsg = apiMsgToMessage(message, currentUserId);
          setMessages(prev => ({
            ...prev,
            [channelId]: (prev[channelId] ?? []).map(m => {
              if (m.id !== tempMessageId) return m;
              // 保留流式阶段写入的 ragSources
              const ragSources = m.metadata?.ragSources;
              return ragSources
                ? { ...finalMsg, metadata: { ...finalMsg.metadata, ragSources } }
                : finalMsg;
            }),
          }));
          setConversations((prev) =>
            applyRecentConversationUpdate(prev, channelId, (conversation) => ({
              ...conversation,
              lastMessage: finalMsg.content,
              lastMessageTime: finalMsg.createdAt,
              lastMessageSenderName: finalMsg.agentName ?? undefined,
            })),
          );
          // 若用户当前不在此频道，累加未读计数
          if (selectedConversationIdRef.current !== channelId) {
            setUnreadCounts(prev => ({ ...prev, [channelId]: (prev[channelId] ?? 0) + 1 }));
          }
        },

        onDone: () => {
          setIsSending(false);
        },

        onError: (err) => {
          console.error('Chat stream error:', err);
          setMessages(prev => ({
            ...prev,
            [channelId]: (prev[channelId] ?? []).filter(m => m.id !== TEMP_USER_ID),
          }));
          setIsSending(false);
        },
      }, libraryTag, enableWebSearch);
    } catch (err) {
      console.error('Send chat error:', err);
      setMessages(prev => ({
        ...prev,
        [channelId]: (prev[channelId] ?? []).filter(m => m.id !== TEMP_USER_ID),
      }));
      setIsSending(false);
    }
  };

  const currentConversation = conversations.find(c => c.id === selectedConversationId);
  const currentMessages = messages[selectedConversationId] ?? [];
  const currentMemberIds = (currentConversation?.members as string[]) || [];
  const currentMemberAgents = hiredAgents
    .filter(a => currentMemberIds.includes(a.agentId))
    .map(a => ({ ...a, avatar: a.avatar ?? undefined }));

  return (
    <>
      <ConversationList
        conversations={conversations}
        selectedId={selectedConversationId}
        onSelect={(id) => {
          setSelectedConversationId(id);
          setUnreadCounts(prev => ({ ...prev, [id]: 0 }));
        }}
        unreadCounts={unreadCounts}
        onCreateChannel={handleOpenCreateChannel}
      />

      <ChatPanel
        key={currentConversation?.id ?? 'chat-panel-empty'}
        conversation={currentConversation}
        messages={currentMessages}
        onOpenSettings={handleOpenSettings}
        onAddMember={currentConversation?.isSingleTalentChannel ? undefined : handleOpenAddMember}
        onRemoveMember={currentConversation?.isSingleTalentChannel ? undefined : handleRemoveMember}
        onPinChannel={handlePinChannel}
        onUnpinChannel={handleUnpinChannel}
        onSendMessage={handleSendMessage}
        onConfirmPlan={handleConfirmPlan}
        onClearMessages={handleClearMessages}
        onGoToAssets={onGoToAssets}
        memberAgents={currentMemberAgents}
        isMemberPanelOpen={currentConversation ? (memberPanelStates[currentConversation.id] ?? false) : false}
        onToggleMemberPanel={handleToggleMemberPanel}
        activeLibraryTag={currentConversation ? (libraryTagByChannel[currentConversation.id] ?? null) : null}
        onSetLibraryTag={(tag) => {
          if (!currentConversation) return;
          setLibraryTagByChannel(prev =>
            tag ? { ...prev, [currentConversation.id]: tag } : Object.fromEntries(Object.entries(prev).filter(([k]) => k !== currentConversation.id))
          );
        }}
        hasMoreHistory={currentConversation ? (historyStateByChannel[currentConversation.id]?.hasMore ?? false) : false}
        isLoadingHistory={currentConversation ? (historyStateByChannel[currentConversation.id]?.isLoading ?? false) : false}
        onLoadMoreHistory={currentConversation ? () => loadMoreHistory(currentConversation.id) : undefined}
      />

      <CreateChannelModal
        isOpen={isCreateChannelOpen}
        onClose={() => setIsCreateChannelOpen(false)}
        onConfirm={handleCreateChannel}
        hiredAgents={hiredAgents}
      />

      <AddMemberModal
        isOpen={isAddMemberOpen}
        onClose={() => setIsAddMemberOpen(false)}
        onConfirm={handleAddMember}
        hiredAgents={hiredAgents}
        existingMemberIds={(currentConversation?.members as string[]) || []}
      />

      <ChannelSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        channel={currentConversation ? {
          id: currentConversation.id,
          name: currentConversation.name,
          avatar: currentConversation.avatar,
          isMuted: currentConversation.isMuted,
          isSingleTalentChannel: currentConversation.isSingleTalentChannel,
        } : null}
        onUpdate={handleUpdateChannel}
        onDelete={handleDeleteChannel}
      />
    </>
  );
}

export default ChatPage;
