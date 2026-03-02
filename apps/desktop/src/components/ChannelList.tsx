import { useTranslation } from 'react-i18next';

interface Group {
  name: string;
}

interface Channel {
  id: string;
  name: string;
  type: 'default' | 'voice';
  unreadCount: number;
}

interface ChannelListProps {
  group?: Group;
  channels: Channel[];
  selectedChannelId: string;
  onSelectChannel: (channelId: string) => void;
}

function ChannelList({ group, channels, selectedChannelId, onSelectChannel }: ChannelListProps) {
  const { t } = useTranslation();

  return (
    <div className="w-60 bg-gray-100 flex flex-col">
      {/* 群组标题 */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-gray-200 bg-white shadow-sm">
        <h2 className="font-semibold text-gray-800 truncate">{group?.name || t('channel.selectGroup')}</h2>
        <button className="text-gray-500 hover:text-gray-700">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* 频道列表 */}
      <div className="flex-1 overflow-y-auto py-2">
        {channels.map((channel) => (
          <div
            key={channel.id}
            onClick={() => onSelectChannel(channel.id)}
            className={`px-2 py-1.5 mx-2 rounded-lg cursor-pointer flex items-center justify-between group
              ${selectedChannelId === channel.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
              }`}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {/* 频道图标 */}
              <span className="text-gray-400 flex-shrink-0">
                {channel.type === 'default' ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                )}
              </span>

              {/* 频道名称 */}
              <span className="text-sm font-medium truncate">{channel.name}</span>
            </div>

            {/* 未读消息徽章 */}
            {channel.unreadCount > 0 && (
              <div className="bg-primary text-white text-xs rounded-full px-2 py-0.5 font-bold flex-shrink-0">
                {channel.unreadCount}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 底部用户信息 */}
      <div className="h-14 px-2 flex items-center gap-2 bg-gray-200 border-t border-gray-300">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-gray-900 truncate">张三</div>
          <div className="text-xs text-gray-500">{t('chat.online')}</div>
        </div>
        <button className="text-gray-500 hover:text-gray-700">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default ChannelList;
