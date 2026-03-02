import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface MessageInputProps {
  channelName: string;
}

function MessageInput({ channelName }: MessageInputProps) {
  const { t } = useTranslation();
  const [message, setMessage] = useState('');

  const handleSend = () => {
    if (message.trim()) {
      console.log('发送消息:', message);
      setMessage('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="px-4 pb-6">
      <div className="bg-gray-100 rounded-lg border border-gray-200 focus-within:border-primary transition-colors">
        {/* 输入框 */}
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={t('messageInput.placeholder', { channelName })}
          className="w-full px-4 py-3 bg-transparent resize-none outline-none text-gray-900 placeholder-gray-400"
          rows={3}
        />

        {/* 工具栏 */}
        <div className="px-4 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* 上传图片 */}
            <button className="p-2 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors" title={t('messageInput.uploadImage')}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>

            {/* 上传文件 */}
            <button className="p-2 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors" title={t('messageInput.uploadFile')}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </button>

            {/* @Plan */}
            <button className="px-3 py-1.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-sm font-medium" title={t('messageInput.createTask')}>
              @Plan
            </button>

            {/* Emoji */}
            <button className="p-2 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors" title={t('messageInput.emoji')}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          </div>

          {/* 发送按钮 */}
          <button
            onClick={handleSend}
            disabled={!message.trim()}
            className="px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {t('chat.send')}
          </button>
        </div>
      </div>

      {/* 提示文字 */}
      <div className="mt-2 text-xs text-gray-400 px-1">
        {t('messageInput.sendHint')}
      </div>
    </div>
  );
}

export default MessageInput;
