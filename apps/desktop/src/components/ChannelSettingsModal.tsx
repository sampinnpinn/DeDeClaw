import { useState, useEffect } from 'react';
import { X, Bell, BellOff, Trash2, ImagePlus } from 'lucide-react';
import { channelService } from '../services/channelService';
import Toast, { type ToastType } from './Toast';
import { CHANNEL_AVATAR_ITEMS, type ChannelAvatarItem } from '../shared/constants/channelAvatar';

interface ChannelData {
  id: string;
  name: string;
  avatar?: string;
  isMuted?: boolean;
  isSingleTalentChannel?: boolean;
}

interface ChannelSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  channel: ChannelData | null;
  onUpdate: (channelId: string, data: { name?: string; avatar?: string; isMuted?: boolean }) => void;
  onDelete: (channelId: string) => void;
}

function ChannelSettingsModal({ isOpen, onClose, channel, onUpdate, onDelete }: ChannelSettingsModalProps) {
  const fallbackAvatarUrl = `${import.meta.env.BASE_URL}dede.webp`;
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [avatarOptions, setAvatarOptions] = useState<ChannelAvatarItem[]>([]);
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<ToastType>('success');
  const [isToastVisible, setIsToastVisible] = useState(false);

  const showToast = (message: string, type: ToastType) => {
    setToastMessage(message);
    setToastType(type);
    setIsToastVisible(false);
    window.requestAnimationFrame(() => {
      setIsToastVisible(true);
    });
  };

  useEffect(() => {
    if (channel) {
      setName(channel.name);
      setAvatar(channel.avatar || '');
      setIsMuted(channel.isMuted || false);
    }
    setShowDeleteConfirm(false);
    setIsAvatarPickerOpen(false);
  }, [channel, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setAvatarOptions(CHANNEL_AVATAR_ITEMS);
  }, [isOpen]);

  const handleSave = async () => {
    if (!channel) return;

    try {
      const updatePayload = isSingleTalentChannel
        ? { isMuted }
        : {
            name,
            avatar: avatar || undefined,
            isMuted,
          };

      const result = await channelService.updateChannel(channel.id, updatePayload);

      if (result.success) {
        onUpdate(channel.id, { name, avatar, isMuted });
        onClose();
        return;
      }

      showToast(result.message ?? '保存频道设置失败', 'error');
    } catch (error) {
      console.error('[ChannelSettingsModal] save failed:', error);
      showToast('保存频道设置失败，请稍后重试', 'error');
    }
  };

  const handleDelete = async () => {
    if (!channel) return;

    try {
      const result = await channelService.deleteChannel(channel.id);

      if (result.success) {
        onDelete(channel.id);
        onClose();
        return;
      }

      showToast(result.message ?? '解散频道失败', 'error');
    } catch (error) {
      console.error('[ChannelSettingsModal] delete failed:', error);
      showToast('解散频道失败，请稍后重试', 'error');
    }
  };

  if (!isOpen || !channel) {
    return null;
  }

  const isSingleTalentChannel = channel.isSingleTalentChannel === true;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <Toast
        message={toastMessage}
        type={toastType}
        isVisible={isToastVisible}
        onClose={() => setIsToastVisible(false)}
      />

      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">频道设置</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors flex items-center justify-center"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* 频道头像 */}
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                <img
                  src={avatar || fallbackAvatarUrl}
                  alt={channel.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-500 mb-1">频道头像</p>
                <button
                  onClick={() => {
                    if (!isSingleTalentChannel) {
                      setIsAvatarPickerOpen((prev) => !prev);
                    }
                  }}
                  disabled={isSingleTalentChannel}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ImagePlus size={14} />
                  {isSingleTalentChannel ? '人才会话不可修改头像' : '选择头像'}
                </button>
              </div>
            </div>

            {isAvatarPickerOpen && (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                {avatarOptions.length === 0 ? (
                  <p className="text-xs text-gray-500">暂无可用头像素材，请检查 chat_icon 目录</p>
                ) : (
                  <div className="grid grid-cols-4 gap-2 max-h-44 overflow-y-auto pr-1">
                    {avatarOptions.map((option) => {
                      const isSelected = avatar === option.avatarUrl;
                      return (
                        <button
                          key={option.fileName}
                          onClick={() => setAvatar(option.avatarUrl)}
                          className={`relative aspect-square rounded-lg overflow-hidden border transition-colors ${
                            isSelected ? 'border-[#7678ee]' : 'border-gray-200 hover:border-gray-300'
                          }`}
                          title={option.fileName}
                        >
                          <img src={option.avatarUrl} alt={option.fileName} className="w-full h-full object-cover" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 频道名称 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">频道名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSingleTalentChannel}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#7678ee] transition-colors disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
              placeholder={isSingleTalentChannel ? '人才会话不可修改名称' : '输入频道名称'}
            />
          </div>

          {/* 消息提醒 */}
          <div
            onClick={() => setIsMuted(!isMuted)}
            className="flex items-center justify-between p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center gap-3">
              {isMuted ? (
                <BellOff size={20} className="text-gray-400" />
              ) : (
                <Bell size={20} className="text-gray-700" />
              )}
              <div>
                <p className="text-sm font-medium text-gray-900">消息免打扰</p>
                <p className="text-xs text-gray-500">{isMuted ? '已开启，不接收消息提醒' : '已关闭，正常接收消息提醒'}</p>
              </div>
            </div>
            <div className={`w-12 h-7 rounded-full p-1 transition-colors ${isMuted ? 'bg-[#7678ee]' : 'bg-gray-300'}`}>
              <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${isMuted ? 'translate-x-5' : 'translate-x-0'}`} />
            </div>
          </div>

          {/* 解散频道 */}
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full flex items-center justify-center gap-2 p-4 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors"
            >
              <Trash2 size={18} />
              <span className="text-sm font-medium">解散频道</span>
            </button>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-sm text-red-800 font-medium mb-2">确定要解散此频道吗？</p>
              <p className="text-xs text-red-600 mb-4">解散后所有聊天记录将被删除，此操作不可恢复。</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-2 rounded-lg text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 py-2 rounded-lg text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors"
                >
                  确认解散
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#2C2D33] hover:bg-[#1a1b1f] transition-colors"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChannelSettingsModal;
