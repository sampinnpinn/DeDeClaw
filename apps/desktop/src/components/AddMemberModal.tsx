import { useState, useEffect } from 'react';
import { X, Check, Lock } from 'lucide-react';
import type { Agent } from '@/shared/types/agent';

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (newAgentIds: string[]) => void;
  hiredAgents: Agent[];
  existingMemberIds: string[];
}

function AddMemberModal({ isOpen, onClose, onConfirm, hiredAgents, existingMemberIds }: AddMemberModalProps) {
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedAgentIds([]);
    }
  }, [isOpen]);

  const toggleAgent = (agentId: string) => {
    if (existingMemberIds.includes(agentId)) return;
    if (selectedAgentIds.includes(agentId)) {
      setSelectedAgentIds(selectedAgentIds.filter(id => id !== agentId));
    } else {
      setSelectedAgentIds([...selectedAgentIds, agentId]);
    }
  };

  const handleConfirm = () => {
    onConfirm(selectedAgentIds);
    onClose();
  };

  const newlySelected = selectedAgentIds.length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">添加成员</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors flex items-center justify-center"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-4">
          <p className="text-sm text-gray-600 mb-4">
            已有成员默认勾选，选择新成员加入频道
          </p>

          {hiredAgents.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              暂无可添加的 Agent
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 max-h-96 overflow-y-auto pr-2">
              {hiredAgents.map((agent) => {
                const isExisting = existingMemberIds.includes(agent.agentId);
                const isSelected = isExisting || selectedAgentIds.includes(agent.agentId);

                return (
                  <div
                    key={agent.agentId}
                    onClick={() => toggleAgent(agent.agentId)}
                    className={`flex items-center gap-2.5 p-2 rounded-lg transition-colors border ${
                      isExisting
                        ? 'bg-gray-50 border-gray-200 cursor-not-allowed opacity-70'
                        : isSelected
                          ? 'bg-[#fff5f4] border-[#7678ee] cursor-pointer'
                          : 'bg-gray-50 border-transparent hover:bg-gray-100 cursor-pointer'
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      <div className="w-9 h-9 rounded-lg overflow-hidden bg-gray-200">
                        {agent.avatar ? (
                          <img
                            src={agent.avatar}
                            alt={agent.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs font-semibold">
                            {agent.name.charAt(0)}
                          </div>
                        )}
                      </div>
                      {isExisting ? (
                        <div className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-gray-400 rounded-full flex items-center justify-center">
                          <Lock size={8} className="text-white" strokeWidth={3} />
                        </div>
                      ) : isSelected ? (
                        <div className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#7678ee] rounded-full flex items-center justify-center">
                          <Check size={10} className="text-white" strokeWidth={3} />
                        </div>
                      ) : null}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{agent.name}</div>
                      <div className="text-xs text-gray-500 truncate">
                        {isExisting ? '已在频道' : agent.role}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-t border-gray-100">
          <div className="text-sm text-gray-600">
            新增 <span className="font-semibold text-gray-900">{newlySelected}</span> 名成员
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleConfirm}
              disabled={newlySelected === 0}
              className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors ${
                newlySelected > 0
                  ? 'bg-[#2C2D33] hover:bg-[#1a1b1f]'
                  : 'bg-gray-300 cursor-not-allowed'
              }`}
            >
              确认添加
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AddMemberModal;
