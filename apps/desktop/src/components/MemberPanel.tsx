import { X, UserPlus, UserMinus } from 'lucide-react';

interface MemberAgent {
  agentId: string;
  name: string;
  role: string;
  avatar?: string;
}

interface MemberPanelProps {
  isOpen: boolean;
  onClose: () => void;
  members: MemberAgent[];
  onAddMember?: () => void;
  onRemoveMember?: (agentId: string) => void;
}

const DEDE_NAME = 'dede';

function MemberPanel({ isOpen, onClose, members, onAddMember, onRemoveMember }: MemberPanelProps) {
  const fallbackAvatarUrl = `${import.meta.env.BASE_URL}dede.webp`;
  const dedeAgent = members.find(m => m.name.toLowerCase() === DEDE_NAME);
  const otherMembers = members.filter(m => m.name.toLowerCase() !== DEDE_NAME);
  const sortedMembers = dedeAgent ? [...otherMembers, dedeAgent] : otherMembers;

  return (
    <div
      className={`flex-shrink-0 bg-white border-l border-gray-100 flex flex-col transition-all duration-300 ease-in-out overflow-hidden ${
        isOpen ? 'w-64' : 'w-0'
      }`}
    >
      {isOpen && (
        <>
          {/* 面板标题 */}
          <div className="h-16 px-4 flex items-center justify-between border-b border-gray-100 flex-shrink-0">
            <span className="font-semibold text-gray-900 text-sm">成员 · {members.length}</span>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors flex items-center justify-center"
            >
              <X size={16} />
            </button>
          </div>

          {/* 添加成员按钮 */}
          {onAddMember && (
            <div className="px-3 pt-3 pb-2 flex-shrink-0">
              <button
                onClick={onAddMember}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border-2 border-dashed border-gray-200 text-gray-500 hover:border-[#7678ee] hover:text-[#7678ee] transition-colors text-sm font-medium"
              >
                <UserPlus size={15} />
                添加成员
              </button>
            </div>
          )}

          {/* 成员列表 */}
          <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
            {sortedMembers.map((agent) => {
              const isDeDe = agent.name.toLowerCase() === DEDE_NAME;
              return (
                <div
                  key={agent.agentId}
                  className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-gray-50 group transition-colors"
                >
                  <div className="w-9 h-9 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
                    {agent.avatar ? (
                      <img
                        src={agent.avatar}
                        alt={agent.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const img = e.target as HTMLImageElement;
                          if (!img.dataset.fallback) {
                            img.dataset.fallback = 'true';
                            img.src = fallbackAvatarUrl;
                          }
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs font-semibold">
                        {agent.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{agent.name}</div>
                    <div className="text-xs text-gray-400 truncate">{agent.role}</div>
                  </div>
                  {onRemoveMember && (
                    <button
                      onClick={() => !isDeDe && onRemoveMember(agent.agentId)}
                      disabled={isDeDe}
                      className={`w-6 h-6 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-colors ${
                        isDeDe
                          ? 'text-gray-200 cursor-not-allowed'
                          : 'text-gray-300 hover:text-red-500 hover:bg-red-50'
                      }`}
                      title={isDeDe ? 'DeDe 为默认成员，不可移除' : '移除成员'}
                    >
                      <UserMinus size={13} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default MemberPanel;
