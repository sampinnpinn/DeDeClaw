import { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import type { Agent } from '@/shared/types/agent';

interface CreateChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selectedAgents: Agent[]) => void;
  hiredAgents: Agent[];
}

function CreateChannelModal({ isOpen, onClose, onConfirm, hiredAgents }: CreateChannelModalProps) {
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedAgentIds([]);
    }
  }, [isOpen]);

  const toggleAgent = (agentId: string) => {
    if (selectedAgentIds.includes(agentId)) {
      setSelectedAgentIds(selectedAgentIds.filter(id => id !== agentId));
    } else {
      setSelectedAgentIds([...selectedAgentIds, agentId]);
    }
  };

  const handleConfirm = () => {
    const selected = hiredAgents.filter(agent => selectedAgentIds.includes(agent.agentId));
    onConfirm(selected);
    onClose();
  };

  const canConfirm = selectedAgentIds.length >= 2;

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">创建频道</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors flex items-center justify-center"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-4">
          <p className="text-sm text-gray-600 mb-4">选择至少 2 名 Agent 创建频道</p>

          {hiredAgents.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              暂无已雇佣的 Agent，请先前往人才市场雇佣
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 max-h-96 overflow-y-auto pr-2">
              {hiredAgents.map((agent) => {
                const isSelected = selectedAgentIds.includes(agent.agentId);
                return (
                  <div
                    key={agent.agentId}
                    onClick={() => toggleAgent(agent.agentId)}
                    className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[#fff5f4] border border-[#7678ee]'
                        : 'bg-gray-50 border border-transparent hover:bg-gray-100'
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      <div className="w-9 h-9 rounded-lg overflow-hidden bg-gray-200">
                        {agent.avatar ? (
                          <img src={agent.avatar} alt={agent.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs font-semibold">
                            {agent.name.charAt(0)}
                          </div>
                        )}
                      </div>
                      {isSelected && (
                        <div className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#7678ee] rounded-full flex items-center justify-center">
                          <Check size={10} className="text-white" strokeWidth={3} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{agent.name}</div>
                      <div className="text-xs text-gray-500 truncate">{agent.role}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-t border-gray-100">
          <div className="text-sm text-gray-600">
            已选择 <span className="font-semibold text-gray-900">{selectedAgentIds.length}</span> 名 Agent
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
              disabled={!canConfirm}
              className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors ${
                canConfirm
                  ? 'bg-[#2C2D33] hover:bg-[#1a1b1f]'
                  : 'bg-gray-300 cursor-not-allowed'
              }`}
            >
              确认创建
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CreateChannelModal;
