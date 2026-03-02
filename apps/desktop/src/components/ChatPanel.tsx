import { useRef, useEffect, useState, useCallback } from 'react';
import Modal from './Modal';
import { MoreVertical, Send, Download, FileText, Eye, Mic, Plus, X, Globe, UserPlus, Settings, Pin, PinOff, Users, LayoutList, BookOpen, Trash2 } from 'lucide-react';
import { libraryService } from '../services/libraryService';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Conversation, Message } from '../mockData';
import DropdownMenu, { MenuItem } from './DropdownMenu';
import MemberPanel from './MemberPanel';
import MentionInput, { type MentionInputHandle } from './MentionInput';
import DedePlanCard from './DedePlanCard';

interface ChatPanelProps {
  conversation?: Conversation;
  messages: Message[];
  hasMoreHistory?: boolean;
  isLoadingHistory?: boolean;
  onLoadMoreHistory?: () => Promise<void>;
  onOpenSettings?: () => void;
  onAddMember?: () => void;
  onRemoveMember?: (agentId: string) => void;
  onPinChannel?: () => void;
  onUnpinChannel?: () => void;
  onSendMessage?: (content: string, mentionedAgentIds: string[], isPlanMode: boolean, libraryTag?: string, enableWebSearch?: boolean) => Promise<void>;
  onConfirmPlan?: (messageId: string, contentTypes: string[]) => void;
  onClearMessages?: () => void;
  onGoToAssets?: () => void;
  memberAgents?: Array<{ agentId: string; name: string; role: string; avatar?: string }>;
  isMemberPanelOpen?: boolean;
  onToggleMemberPanel?: () => void;
  activeLibraryTag?: string | null;
  onSetLibraryTag?: (tag: string | null) => void;
}

function ChatPanel({
  conversation,
  messages,
  hasMoreHistory = false,
  isLoadingHistory = false,
  onLoadMoreHistory,
  onOpenSettings,
  onAddMember,
  onRemoveMember,
  onPinChannel,
  onUnpinChannel,
  onSendMessage,
  onConfirmPlan,
  onClearMessages,
  onGoToAssets,
  memberAgents = [],
  isMemberPanelOpen = false,
  onToggleMemberPanel,
  activeLibraryTag = null,
  onSetLibraryTag,
}: ChatPanelProps) {
  const { t, i18n } = useTranslation();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const isLoadingMoreRef = useRef(false);
  const shouldKeepScrollPositionRef = useRef(false);
  const previousScrollHeightRef = useRef(0);
  const [isOnlineMode, setIsOnlineMode] = useState(false);
  const [isPlanMode, setIsPlanMode] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isTagMenuOpen, setIsTagMenuOpen] = useState(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [libraryTags, setLibraryTags] = useState<string[]>([]);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const tagButtonRef = useRef<HTMLButtonElement>(null);
  const tagMenuRef = useRef<HTMLDivElement>(null);
  const mentionInputRef = useRef<MentionInputHandle>(null);
  const [isSendingLocal, setIsSendingLocal] = useState(false);

  useEffect(() => {
    if (!isTagMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        tagMenuRef.current && !tagMenuRef.current.contains(e.target as Node) &&
        tagButtonRef.current && !tagButtonRef.current.contains(e.target as Node)
      ) {
        setIsTagMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isTagMenuOpen]);

  const fetchTags = useCallback(async () => {
    try {
      const tags = await libraryService.getTags();
      setLibraryTags(tags);
    } catch { setLibraryTags([]); }
  }, []);

  useEffect(() => {
    setIsTagMenuOpen(false);
  }, [conversation?.id]);

  const handleSend = async () => {
    if (!mentionInputRef.current || isSendingLocal) return;
    const content = mentionInputRef.current.getTextContent();
    if (!content.trim()) return;
    const mentionedAgentIds = mentionInputRef.current.getMentionedAgentIds();
    setIsSendingLocal(true);
    mentionInputRef.current.clear();
    try {
      await onSendMessage?.(content, mentionedAgentIds, isPlanMode, activeLibraryTag ?? undefined, isOnlineMode);
    } finally {
      setIsSendingLocal(false);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    const messageList = messageListRef.current;
    if (!messageList) return;

    if (shouldKeepScrollPositionRef.current) {
      if (isLoadingHistory) {
        return;
      }

      const scrollDiff = messageList.scrollHeight - previousScrollHeightRef.current;
      messageList.scrollTop = Math.max(scrollDiff, 0);
      shouldKeepScrollPositionRef.current = false;
      return;
    }

    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [isLoadingHistory, messages]);

  useEffect(() => {
    if (!isLoadingHistory) {
      isLoadingMoreRef.current = false;
    }
  }, [isLoadingHistory]);

  const handleMessageListScroll = useCallback(async () => {
    const messageList = messageListRef.current;
    if (!messageList || !onLoadMoreHistory || !hasMoreHistory || isLoadingHistory || isLoadingMoreRef.current) {
      return;
    }

    if (messageList.scrollTop <= 24) {
      isLoadingMoreRef.current = true;
      shouldKeepScrollPositionRef.current = true;
      previousScrollHeightRef.current = messageList.scrollHeight;
      await onLoadMoreHistory();
    }
  }, [hasMoreHistory, isLoadingHistory, onLoadMoreHistory]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const menuItems: MenuItem[] = [
    ...(onAddMember
      ? [{
          id: 'add-member',
          label: t('chat.addMember'),
          icon: <UserPlus size={16} />,
          onClick: () => {
            setIsMenuOpen(false);
            onAddMember();
          },
        }]
      : []),
    conversation?.isPinned
      ? {
          id: 'pin',
          label: t('chat.unpinChannel'),
          icon: <PinOff size={16} />,
          onClick: () => {
            setIsMenuOpen(false);
            onUnpinChannel?.();
          },
        }
      : {
          id: 'pin',
          label: t('chat.pinChannel'),
          icon: <Pin size={16} />,
          onClick: () => {
            setIsMenuOpen(false);
            onPinChannel?.();
          },
        },
    {
      id: 'settings',
      label: t('chat.channelSettings'),
      icon: <Settings size={16} />,
      onClick: () => {
        setIsMenuOpen(false);
        onOpenSettings?.();
      },
    },
    {
      id: 'clear',
      label: '清空对话',
      icon: <Trash2 size={16} />,
      danger: true,
      onClick: () => {
        setIsMenuOpen(false);
        setIsClearConfirmOpen(true);
      },
    },
  ];


  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-400">
          <div className="mb-4 flex justify-center">
            <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <p className="text-lg">{t('chat.selectConversation')}</p>
        </div>
      </div>
    );
  }

  const isChannel = conversation.id.startsWith('CH');
  const memberCount = isChannel ? memberAgents.length : (conversation.memberCount ?? 0);

  return (
    <div className="flex-1 flex bg-[#F5F7FA] relative overflow-hidden">
      {/* 主聊天区域 */}
      <div className="flex-1 flex flex-col min-w-0">
      {/* 顶部标题栏 */}
      <div className="desktop-topbar px-6 flex items-center justify-between bg-white border-b border-gray-100" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
        <div className="flex flex-col">
          <h2 className="font-bold text-gray-900 text-lg">
            {conversation.name}
          </h2>
          {conversation.description && (
            <span className="text-xs text-gray-400">
              {conversation.description}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          {/* 成员数量按钮 - 仅频道显示 */}
          {isChannel && (
            <button
              onClick={onToggleMemberPanel}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                isMemberPanelOpen
                  ? 'bg-[#7678ee]/10 text-[#7678ee]'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            >
              <Users size={16} />
              <span className="font-medium">{memberCount}</span>
            </button>
          )}
          <div className="relative">
            <button 
              ref={menuButtonRef}
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500" 
              title={t('chat.more')}
            >
              <MoreVertical size={20} />
            </button>
            <DropdownMenu
              items={menuItems}
              isOpen={isMenuOpen}
              onClose={() => setIsMenuOpen(false)}
              triggerRef={menuButtonRef}
              align="right"
            />
          </div>
        </div>
      </div>

      {/* 消息区域 */}
      <div
        ref={messageListRef}
        className="flex-1 overflow-y-auto px-6 py-6 pb-40 space-y-4"
        onScroll={() => {
          void handleMessageListScroll();
        }}
      >
        {isLoadingHistory && (
          <div className="flex justify-center">
            <div className="text-xs text-gray-400 bg-white rounded-full px-3 py-1 border border-gray-100">
              加载历史消息中...
            </div>
          </div>
        )}
        {messages.map((message) => {
          // 系统消息
          if (message.type === 'system') {
            return (
              <div key={message.id} className="flex justify-center my-6">
                <div className="bg-gray-200 text-gray-500 text-xs px-4 py-1.5 rounded-full">
                  {message.content}
                </div>
              </div>
            );
          }

          const isSelf = message.isSelf;

          // 计划消息：独立布局，不受气泡宽度限制
          if (message.type === 'dede_plan') {
            return (
              <div key={message.id} className="flex gap-3">
                <div className="w-10 h-10 rounded-2xl overflow-hidden flex-shrink-0 bg-gray-900 flex items-center justify-center">
                  {message.avatar ? (
                    <img src={message.avatar} alt={message.agentName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-white text-base font-bold">{(message.agentName || 'D')[0]}</span>
                  )}
                </div>
                <div className="flex flex-col items-start flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 px-1">
                    <span className="text-sm font-bold text-gray-900">{message.agentName}</span>
                  </div>
                  <DedePlanCard
                    agentName={message.agentName ?? 'DeDe'}
                    agentAvatar={message.avatar}
                    plans={message.metadata?.plans ?? []}
                    planCount={message.metadata?.planCount ?? 1}
                    isLoading={!message.metadata?.plans || message.metadata.plans.length === 0}
                    confirmed={message.metadata?.confirmed ?? false}
                    onConfirm={(contentTypes) => onConfirmPlan?.(message.id, contentTypes)}
                  />
                  <div className="flex items-center gap-2 mt-1.5 px-1 text-[10px] text-gray-400">
                    <span>{formatTime(message.createdAt)}</span>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div key={message.id} className={`flex gap-3 ${isSelf ? 'flex-row-reverse' : ''}`}>
              {/* 头像 */}
              {!isSelf && (
                <div className="w-10 h-10 rounded-2xl overflow-hidden flex-shrink-0 bg-gray-200">
                  {message.avatar ? (
                    <img
                      src={message.avatar}
                      alt={message.userName || message.agentName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-base font-semibold text-gray-500">
                      {(message.userName || message.agentName || '?')[0]}
                    </div>
                  )}
                </div>
              )}

              {/* 消息内容 */}
              <div className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'} max-w-[65%]`}>
                {/* 用户名 */}
                {!isSelf && (
                  <div className="flex items-center gap-2 mb-1.5 px-1">
                    <span className="text-sm font-bold text-gray-900">
                      {message.userName || message.agentName}
                    </span>
                  </div>
                )}

                {/* 文本消息 */}
                {message.type === 'text' && (
                  <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    isSelf 
                      ? 'bg-[#7678ee] text-white' 
                      : 'bg-white text-gray-900'
                  }`}>
                    {message.content
                      ? <>
                          <div className={`prose prose-sm max-w-none break-words
                            [&_p]:my-0.5 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0
                            [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0
                            [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm
                            [&_pre]:rounded-lg [&_pre]:text-xs [&_pre]:overflow-x-auto
                            [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs
                            [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:my-1
                            [&_table]:text-xs [&_th]:px-2 [&_th]:py-1 [&_td]:px-2 [&_td]:py-1
                            ${isSelf
                              ? 'text-white [&_*]:text-white [&_code]:bg-white/20 [&_pre]:bg-white/20 [&_blockquote]:border-white/40 [&_strong]:text-white [&_em]:text-white [&_a]:text-white/90'
                              : '[&_code]:bg-gray-100 [&_pre]:bg-gray-100 [&_blockquote]:border-gray-300 [&_blockquote]:text-gray-600'
                            }`}>
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {message.content}
                            </ReactMarkdown>
                          </div>
                          {message.metadata?.viewTaskProgress && (
                            <button
                              onClick={onGoToAssets}
                              className="mt-3 px-4 py-2 rounded-xl bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200 transition-colors"
                            >
                              点击前往
                            </button>
                          )}
                        </>
                      : (
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          {message.metadata?.loadingText && <span>{message.metadata.loadingText}</span>}
                          <span className="typing-dots" aria-label="loading">
                            <span className="typing-dot" />
                            <span className="typing-dot" />
                            <span className="typing-dot" />
                          </span>
                        </div>
                      )
                    }
                  </div>
                )}

                {/* 图片消息 */}
                {message.type === 'image' && message.metadata?.imageUrl && (
                  <div className="rounded-2xl overflow-hidden cursor-pointer relative">
                    <img
                      src={message.metadata.imageUrl}
                      alt={t('chat.uploadImage')}
                      className="max-w-sm max-h-80 object-contain"
                    />
                    <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                      <Eye size={12} />
                      <span>{t('chat.views', { count: 10 })}</span>
                      <span className="ml-1">{formatTime(message.createdAt)}</span>
                    </div>
                  </div>
                )}

                {/* 文件消息 */}
                {message.type === 'file' && message.metadata?.fileName && (
                  <div className="bg-white rounded-2xl p-3 flex items-center gap-3 cursor-pointer">
                    <div className="w-10 h-10 bg-[#7678ee] text-white rounded-lg flex items-center justify-center flex-shrink-0">
                      <FileText size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {message.metadata.fileName}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatFileSize(message.metadata.fileSize || 0)}
                      </div>
                    </div>
                    <button className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 hover:text-[#7678ee]">
                      <Download size={16} />
                    </button>
                  </div>
                )}

                {/* 知识库引用来源 */}
                {!isSelf && message.metadata?.ragSources && (message.metadata.ragSources as string[]).length > 0 && (
                  <div className="mt-1.5 px-1 flex flex-wrap gap-1">
                    {(message.metadata.ragSources as string[]).map((fileName) => (
                      <span
                        key={fileName}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 text-[10px]"
                      >
                        <FileText size={9} />
                        {fileName}
                      </span>
                    ))}
                  </div>
                )}

                {/* 消息底部信息 */}
                <div className={`flex items-center gap-2 mt-1.5 px-1 text-[10px] text-gray-400 ${isSelf ? 'flex-row-reverse' : ''}`}>
                  <span>{formatTime(message.createdAt)}</span>
                  {isSelf && (
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/>
                    </svg>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* 底部输入框 */}
      <div className="absolute bottom-0 left-0 right-0 px-6 pb-4 pointer-events-none">
        <div className="bg-white/60 backdrop-blur-md rounded-3xl px-4 py-3 shadow-lg border border-white/80 pointer-events-auto relative">
          <div className="mb-2" onKeyDown={handleInputKeyDown}>
            <MentionInput
              ref={mentionInputRef}
              placeholder={t('chat.inputPlaceholder')}
              members={memberAgents}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <div className="relative">
                {activeLibraryTag ? (
                  <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#7678ee]/10 text-[#7678ee] text-sm font-medium">
                    <BookOpen size={14} />
                    <span className="max-w-[80px] truncate">{activeLibraryTag}</span>
                    <button
                      onClick={() => onSetLibraryTag?.(null)}
                      className="ml-0.5 hover:text-[#e04f43] transition-colors"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <button
                    ref={tagButtonRef}
                    onClick={() => { fetchTags(); setIsTagMenuOpen(!isTagMenuOpen); }}
                    className="p-2 hover:bg-gray-50 rounded-lg transition-colors text-gray-500"
                    title="选择知识库"
                  >
                    <Plus
                      size={20}
                      className={`transition-transform duration-200 ${isTagMenuOpen ? 'rotate-45' : ''}`}
                    />
                  </button>
                )}
                {isTagMenuOpen && !activeLibraryTag && (
                  <div
                    ref={tagMenuRef}
                    className="absolute bottom-full left-0 mb-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50"
                  >
                    {libraryTags.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-gray-400">暂无知识库标签</div>
                    ) : (
                      libraryTags.map((tag) => (
                        <button
                          key={tag}
                          onClick={() => { onSetLibraryTag?.(tag); setIsTagMenuOpen(false); }}
                          className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                        >
                          <BookOpen size={14} className="text-gray-400 flex-shrink-0" />
                          <span className="truncate">{tag}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              
              <button 
                className={`p-2 hover:bg-gray-50 rounded-lg ${
                  isOnlineMode ? 'text-[#7678ee]' : 'text-gray-500'
                }`}
                onClick={() => setIsOnlineMode(!isOnlineMode)}
                title={t('chat.onlineMode')}
              >
                <Globe size={20} />
              </button>

              <button
                className={`p-2 hover:bg-gray-50 rounded-lg ${
                  isPlanMode ? 'text-[#7678ee]' : 'text-gray-500'
                }`}
                onClick={() => setIsPlanMode(!isPlanMode)}
                title={isPlanMode ? '退出计划模式' : '计划模式'}
              >
                <LayoutList size={20} />
              </button>
            </div>
            
            <div className="flex items-center gap-1">
              <button className="p-2 hover:bg-gray-50 rounded-lg transition-colors text-gray-500" title={t('chat.voice')}>
                <Mic size={20} />
              </button>
              
              <button
                onClick={handleSend}
                disabled={isSendingLocal}
                className={`p-2 rounded-lg transition-colors ${
                  isSendingLocal ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-gray-50 text-gray-500'
                }`}
                title={t('chat.send')}
              >
                <Send size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>

      <Modal
        isOpen={isClearConfirmOpen}
        onClose={() => setIsClearConfirmOpen(false)}
        title="清空对话"
        confirmText="确认清空"
        cancelText="取消"
        confirmButtonVariant="danger"
        onConfirm={() => {
          setIsClearConfirmOpen(false);
          onClearMessages?.();
        }}
      >
        确定要清空当前频道的所有消息和记忆吗？此操作不可恢复，相当于重新开始一个新群聊。
      </Modal>

      <MemberPanel
        isOpen={isMemberPanelOpen}
        onClose={() => onToggleMemberPanel?.()}
        members={memberAgents}
        onAddMember={onAddMember}
        onRemoveMember={onRemoveMember}
      />
    </div>
  );
}

export default ChatPanel;
