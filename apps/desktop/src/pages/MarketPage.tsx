import { useMemo, useState, useEffect } from 'react';
import { Search, UserStar, Aperture, MessageCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { fetchListedAgents } from '@/services/api';
import { agentHireService } from '../services/agentHireService';
import { channelService } from '../services/channelService';
import Modal from '../components/Modal';
import type { Agent } from '@/shared/types/agent';
import type { ChannelData } from '../shared/types/channel';

interface MarketPageProps {
  isActive?: boolean;
  onOpenTalentChat?: (channel: ChannelData) => void;
}

function MarketPage({ isActive, onOpenTalentChat }: MarketPageProps) {
  const fallbackAvatarUrl = `${import.meta.env.BASE_URL}dede.webp`;
  const { t } = useTranslation();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [myAgents, setMyAgents] = useState<Agent[]>([]);
  const [hiredAgentIds, setHiredAgentIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'全部' | '我的'>('全部');
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [openingChatAgentId, setOpeningChatAgentId] = useState<string | null>(null);
  const [cancelHireModal, setCancelHireModal] = useState<{ isOpen: boolean; agent: Agent | null }>({ isOpen: false, agent: null });

  // 加载已上架的 Agent 数据和雇佣状态
  useEffect(() => {
    if (isActive) {
      setIsLoading(true);
      Promise.all([
        fetchListedAgents(),
        agentHireService.getHireStatus(),
        agentHireService.getMyAgents(),
      ]).then(([agentsData, statusRes, myAgentsRes]) => {
        setAgents(agentsData);
        if (statusRes.success) {
          setHiredAgentIds(statusRes.data);
        }
        if (myAgentsRes.success) {
          setMyAgents(myAgentsRes.data);
        }
        setIsLoading(false);
      }).catch(() => {
        setIsLoading(false);
      });
    }
  }, [isActive]);

  // 重置选中状态
  useEffect(() => {
    if (!isActive && selectedAgentId !== null) {
      setSelectedAgentId(null);
    }
  }, [isActive, selectedAgentId]);

  // 过滤数据
  const 过滤后的数据 = useMemo(() => {
    const 关键词 = searchQuery.trim().toLowerCase();
    const sourceAgents = viewMode === '我的' ? myAgents : agents;

    return sourceAgents.filter((agent) => {
      return (
        关键词.length === 0 ||
        agent.name.toLowerCase().includes(关键词) ||
        agent.role.toLowerCase().includes(关键词) ||
        (agent.description?.toLowerCase().includes(关键词) ?? false)
      );
    });
  }, [agents, myAgents, searchQuery, viewMode]);

  const handleHire = async (agentId: string) => {
    const result = await agentHireService.hireAgent(agentId);
    if (result.success) {
      setHiredAgentIds([...hiredAgentIds, agentId]);
      const myAgentsRes = await agentHireService.getMyAgents();
      if (myAgentsRes.success) {
        setMyAgents(myAgentsRes.data);
      }
    }
  };

  const handleOpenTalentChat = async (agent: Agent) => {
    if (openingChatAgentId === agent.agentId) {
      return;
    }

    setOpeningChatAgentId(agent.agentId);
    try {
      const result = await channelService.createChannel(
        [agent.agentId],
        agent.name,
        agent.avatar ?? undefined,
        'hired-talent-chat',
      );

      if (result.success && result.data) {
        onOpenTalentChat?.(result.data);
        return;
      }

      window.alert(result.message ?? '打开会话失败，请稍后重试');
    } catch (error) {
      console.error('[MarketPage] open talent chat failed:', error);
      window.alert('打开会话失败，请稍后重试');
    } finally {
      setOpeningChatAgentId(null);
    }
  };

  const handleCancelHireClick = (agent: Agent) => {
    setCancelHireModal({ isOpen: true, agent });
  };

  const handleCancelHireConfirm = async () => {
    if (!cancelHireModal.agent) return;

    const result = await agentHireService.cancelHire(cancelHireModal.agent.agentId);
    if (result.success) {
      setHiredAgentIds(hiredAgentIds.filter(id => id !== cancelHireModal.agent!.agentId));
      setMyAgents(myAgents.filter(a => a.agentId !== cancelHireModal.agent!.agentId));
      setCancelHireModal({ isOpen: false, agent: null });
    }
  };

  // 获取默认头像
  const getAvatarUrl = (agent: Agent): string => {
    if (agent.avatar) return agent.avatar;
    return fallbackAvatarUrl;
  };

  return (
    <div className="flex-1 flex flex-col bg-[#F5F7FA] overflow-hidden">
      {/* 顶部搜索栏 */}
      <div
        className="desktop-topbar px-6 flex items-center justify-between bg-white border-b border-gray-100 flex-shrink-0"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="flex items-center gap-6" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <div className="w-72 bg-[#F5F7FA] rounded-2xl px-4 py-2.5 flex items-center gap-3 border border-gray-100">
            <Search size={18} className="text-gray-500" />
            <input
              type="text"
              placeholder={t('market.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent outline-none text-sm text-gray-700 placeholder-gray-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <button
            onClick={() => setViewMode('全部')}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
              viewMode === '全部'
                ? 'bg-[#2C2D33] text-white'
                : 'bg-transparent text-gray-600 hover:bg-gray-100'
            }`}
            title={t('market.all')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </button>
          <button
            onClick={() => setViewMode('我的')}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
              viewMode === '我的'
                ? 'bg-[#2C2D33] text-white'
                : 'bg-transparent text-gray-600 hover:bg-gray-100'
            }`}
            title={t('market.mine')}
          >
            <UserStar size={18} />
          </button>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* 加载状态 */}
        {isLoading ? (
          <div className="mt-8 text-center text-sm text-gray-400">
            {t('common.loading') || '加载中...'}
          </div>
        ) : (
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3">
            {过滤后的数据.map((agent) => {
              const isShowingDetail = selectedAgentId === agent.agentId;

              return (
                <div
                  key={agent.agentId}
                  className="relative bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                >
                  {/* 正常卡片内容 */}
                  <div className={isShowingDetail ? 'pointer-events-none' : ''}>
                    <div className="flex flex-col">
                      {/* 头像 */}
                      <div className="w-full h-0 pb-[100%] relative bg-gray-100">
                        <img
                          src={getAvatarUrl(agent)}
                          alt={agent.name}
                          className="absolute inset-0 w-full h-full object-cover"
                          onError={(e) => {
                            const img = e.target as HTMLImageElement;
                            if (!img.dataset.fallback) {
                              img.dataset.fallback = 'true';
                              img.src = fallbackAvatarUrl;
                            }
                          }}
                        />
                      </div>

                      {/* 信息 */}
                      <div className="p-3">
                        <div className="flex items-center justify-between mb-0.5">
                          <div className="flex items-center gap-1.5">
                            <h3 className="text-sm font-semibold text-gray-900">{agent.name}</h3>
                            {hiredAgentIds.includes(agent.agentId) && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#7678ee] text-white">
                                已雇佣
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            {hiredAgentIds.includes(agent.agentId) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleOpenTalentChat(agent);
                                }}
                                disabled={openingChatAgentId === agent.agentId}
                                className="hover:text-gray-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                title="发起对话"
                              >
                                <MessageCircle size={14} className="text-gray-400 flex-shrink-0" />
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedAgentId(agent.agentId);
                              }}
                              className="hover:text-gray-600 transition-colors"
                            >
                              <Aperture size={14} className="text-gray-400 flex-shrink-0" />
                            </button>
                          </div>
                        </div>

                        <p className="text-xs text-gray-500 mb-2">{agent.role}</p>

                        <p
                          className="text-xs text-gray-600 mb-2 line-clamp-2 min-h-[28px]"
                          title={agent.description || ''}
                        >
                          {agent.description || '暂无简介'}
                        </p>

                        <div className="flex items-center gap-1 mb-2 text-xs text-gray-700">
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 16 16"
                            fill="none"
                            className="text-gray-400"
                          >
                            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                            <path
                              d="M8 4V8L11 10"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            />
                          </svg>
                          <span className="font-medium">{agent.priceRate.toFixed(1)}x</span>
                          <span className="text-gray-400">/ {t('market.hour')}</span>
                        </div>

                        {hiredAgentIds.includes(agent.agentId) ? (
                          <button
                            onClick={() => handleCancelHireClick(agent)}
                            className="w-full py-1.5 rounded-lg text-xs font-medium transition-colors bg-[#7678ee]/10 text-[#7678ee] hover:bg-[#7678ee]/20"
                          >
                            取消雇佣
                          </button>
                        ) : (
                          <button
                            onClick={() => handleHire(agent.agentId)}
                            className="w-full py-1.5 rounded-lg text-xs font-medium transition-colors bg-black text-white hover:bg-gray-800"
                          >
                            <span className="flex items-center justify-center gap-1">
                              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                                <path
                                  d="M5 7L8 4L11 7M8 4V12"
                                  stroke="currentColor"
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                              雇佣
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 详情覆盖层 */}
                  <div
                    className={`absolute inset-0 bg-white/70 backdrop-blur-xl backdrop-saturate-125 border border-white/80 shadow-lg flex flex-col overflow-hidden rounded-xl transition-all duration-200 ease-out ${
                      isShowingDetail
                        ? 'opacity-100 scale-100 pointer-events-auto'
                        : 'opacity-0 scale-[0.98] pointer-events-none'
                    }`}
                  >
                    <div className="flex-1 p-4 overflow-hidden">
                      <h3 className="text-base font-semibold text-gray-900 mb-3">
                        {t('market.profile')}
                      </h3>
                      <div className="text-sm text-gray-700 leading-relaxed line-clamp-[14]">
                        {agent.description || '暂无简介'}
                      </div>
                    </div>
                    <div className="px-3 pb-3 flex-shrink-0">
                      <button
                        onClick={() => setSelectedAgentId(null)}
                        className="w-full py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 transition-colors flex items-center justify-center gap-1"
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 16 16"
                          fill="none"
                          stroke="currentColor"
                        >
                          <path
                            d="M10 12L6 8L10 4"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        {t('common.back')}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {过滤后的数据.length === 0 && !isLoading && (
          <div className="mt-8 text-center text-sm text-gray-400">
            {t('market.noMatchedAgents')}
          </div>
        )}
      </div>

      <Modal
        isOpen={cancelHireModal.isOpen}
        onClose={() => setCancelHireModal({ isOpen: false, agent: null })}
        title="确认取消雇佣"
        onConfirm={handleCancelHireConfirm}
        confirmText="确认取消"
        cancelText="保留"
        confirmButtonVariant="danger"
      >
        <p className="mb-3">
          确定要取消雇佣 <strong>{cancelHireModal.agent?.name}</strong> 吗？
        </p>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-2">
          <p className="text-yellow-800 text-sm font-medium">⚠️ 重要提示</p>
          <p className="text-yellow-700 text-xs mt-1">
            取消雇佣后，所有群聊中的该角色将同时消失，无法继续使用。
          </p>
        </div>
      </Modal>
    </div>
  );
}

export default MarketPage;
