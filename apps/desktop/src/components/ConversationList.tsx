import { Search, Plus, Pin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Conversation } from '../mockData';

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string;
  onSelect: (id: string) => void;
  onCreateChannel?: () => void;
  unreadCounts?: Record<string, number>;
}

function ConversationList({ conversations, selectedId, onSelect, onCreateChannel, unreadCounts = {} }: ConversationListProps) {
  const { t } = useTranslation();

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return t('time.justNow');
    if (minutes < 60) return t('conversation.minutes', { count: minutes });
    if (hours < 24) return t('conversation.hours', { count: hours });
    if (days === 1) return t('conversation.yesterday');
    return t('time.daysAgo', { count: days });
  };

  return (
    <div className="w-80 bg-[#E8E9F3] flex flex-col">
      {/* 顶部搜索栏 */}
      <div className="desktop-topbar-tall px-5 flex items-center gap-3" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
        <div className="flex-1 bg-[#D5D7E8] rounded-2xl px-4 py-2.5 flex items-center gap-3" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <Search size={18} className="text-gray-500" />
          <input
            type="text"
            placeholder={t('conversation.searchPlaceholder')}
            className="flex-1 bg-transparent outline-none text-sm text-gray-700 placeholder-gray-500"
          />
        </div>
        <div className="relative" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <button 
            onClick={() => onCreateChannel?.()}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-600 hover:bg-white/50 transition-colors"
          >
            <Plus size={20} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* 会话列表 */}
      <div className="flex-1 overflow-y-auto px-4 pb-3">
        {conversations.map((conv) => (
          <div
            key={conv.id}
            onClick={() => onSelect(conv.id)}
            className={`px-3 py-2.5 mb-1.5 cursor-pointer rounded-2xl transition-all duration-200 group
              ${selectedId === conv.id
                ? 'bg-white/70'
                : conv.isPinned
                  ? 'bg-white/30 hover:bg-white/50'
                  : 'hover:bg-white/40'}`}
          >
            <div className="flex items-start gap-3">
              {/* 头像 */}
              <div className="relative flex-shrink-0">
                <div className="w-12 h-12 rounded-2xl overflow-hidden bg-gray-200">
                  {conv.avatar ? (
                    <img
                      src={conv.avatar}
                      alt={conv.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-lg font-semibold text-gray-500">
                      {conv.name[0]}
                    </div>
                  )}
                </div>
                {(unreadCounts[conv.id] ?? conv.unreadCount) > 0 && (
                  <div className="absolute -top-1 -right-1 bg-[#7678ee] text-white text-[10px] rounded-full min-w-[18px] h-[18px] flex items-center justify-center font-bold border-2 border-[#E8E9F3]">
                    {unreadCounts[conv.id] ?? conv.unreadCount}
                  </div>
                )}
              </div>

              {/* 内容 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between mb-1">
                  <h3 className="font-semibold truncate text-gray-900">
                    {conv.name}
                  </h3>
                  <span className="text-[11px] text-gray-500 flex-shrink-0 ml-2">
                    {formatTime(conv.lastMessageTime)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm truncate text-gray-500 flex-1 min-w-0">
                    {conv.lastMessageSenderName
                      ? <><span className="font-medium text-gray-600">{conv.lastMessageSenderName}:</span> {conv.lastMessage}</>
                      : conv.lastMessage
                    }
                  </p>
                  {conv.isPinned && (
                    <Pin size={11} className="text-gray-400 flex-shrink-0 ml-1" style={{ transform: 'rotate(45deg)' }} />
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ConversationList;
