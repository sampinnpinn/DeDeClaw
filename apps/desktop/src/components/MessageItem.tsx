import { useTranslation } from 'react-i18next';
import { Message } from '../mockData';

interface MessageItemProps {
  message: Message;
}

function MessageItem({ message }: MessageItemProps) {
  const { t, i18n } = useTranslation();
  
  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return t('time.justNow');
    if (minutes < 60) return t('time.minutesAgo', { count: minutes });
    if (hours < 24) return t('time.hoursAgo', { count: hours });
    if (days < 7) return t('time.daysAgo', { count: days });
    return date.toLocaleDateString(i18n.language);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // 系统消息
  if (message.type === 'system') {
    return (
      <div className="flex justify-center my-4">
        <div className="bg-blue-50 text-blue-600 text-sm px-4 py-2 rounded-full">
          {message.content}
        </div>
      </div>
    );
  }

  const isAgent = !!message.agentId;
  const displayName = isAgent ? message.agentName : message.userName;
  const avatar = message.avatar;

  return (
    <div className="flex gap-3 mb-4 hover:bg-gray-50 -mx-2 px-2 py-1 rounded-lg group">
      {/* 头像 */}
      <div className="flex-shrink-0">
        <img
          src={avatar}
          alt={displayName}
          className="w-10 h-10 rounded-full"
        />
      </div>

      {/* 消息内容 */}
      <div className="flex-1 min-w-0">
        {/* 用户名和时间 */}
        <div className="flex items-baseline gap-2 mb-1">
          <span className={`font-semibold ${isAgent ? 'text-primary' : 'text-gray-900'}`}>
            {displayName}
          </span>
          {isAgent && (
            <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
              AI
            </span>
          )}
          <span className="text-xs text-gray-400">{formatTime(message.createdAt)}</span>
        </div>

        {/* 文本消息 */}
        {message.type === 'text' && (
          <div className="text-gray-700 whitespace-pre-wrap break-words">
            {message.isLoading ? (
              <div className="flex items-center gap-2 text-gray-400">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span>{message.content}</span>
              </div>
            ) : (
              message.content
            )}
          </div>
        )}

        {/* 图片消息 */}
        {message.type === 'image' && message.metadata?.imageUrl && (
          <div className="mt-2">
            <img
              src={message.metadata.imageUrl}
              alt="Image"
              className="max-w-md rounded-lg border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity"
              style={{
                maxHeight: '400px',
                objectFit: 'contain',
              }}
            />
          </div>
        )}

        {/* 文件消息 */}
        {message.type === 'file' && message.metadata?.fileName && (
          <div className="mt-2 max-w-md">
            <div className="flex items-center gap-3 p-3 bg-gray-100 rounded-lg border border-gray-200 hover:bg-gray-200 cursor-pointer transition-colors">
              <div className="flex-shrink-0 w-10 h-10 bg-primary/10 rounded flex items-center justify-center">
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {message.metadata.fileName}
                </div>
                {message.metadata.fileSize && (
                  <div className="text-xs text-gray-500">
                    {formatFileSize(message.metadata.fileSize)}
                  </div>
                )}
              </div>
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 消息操作按钮（悬停显示） */}
      <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex gap-1">
          <button className="p-1.5 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-700" title={t('common.reply')}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
          </button>
          <button className="p-1.5 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-700" title={t('common.more')}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default MessageItem;
