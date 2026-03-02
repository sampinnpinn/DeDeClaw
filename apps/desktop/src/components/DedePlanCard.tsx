import { useState } from 'react';
import { Check } from 'lucide-react';
import type { PlanItem } from '../mockData';

interface DedePlanCardProps {
  agentName: string;
  agentAvatar?: string;
  plans: PlanItem[];
  planCount: number;
  isLoading: boolean;
  confirmed: boolean;
  onConfirm: (contentTypes: string[]) => void;
}

const CONTENT_TYPES = [
  { key: '文章', label: '文章', disabled: false },
  { key: '笔记', label: '笔记', disabled: true },
  { key: '视频', label: '视频', disabled: true },
  { key: '图片', label: '图片', disabled: true },
];

function SkeletonCard() {
  return (
    <div className="bg-gray-50 rounded-xl p-4 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-3" />
      <div className="space-y-2">
        <div className="h-3 bg-gray-200 rounded w-full" />
        <div className="h-3 bg-gray-200 rounded w-5/6" />
        <div className="h-3 bg-gray-200 rounded w-4/6" />
      </div>
    </div>
  );
}

function DedePlanCard({
  plans,
  planCount,
  isLoading,
  confirmed,
  onConfirm,
}: DedePlanCardProps) {
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['文章']);

  const toggleType = (key: string, disabled: boolean) => {
    if (confirmed) return;
    if (disabled) return;
    setSelectedTypes(prev =>
      prev.includes(key) ? prev.filter(t => t !== key) : [...prev, key]
    );
  };

  const handleConfirm = () => {
    if (confirmed || selectedTypes.length === 0) return;
    onConfirm(selectedTypes);
  };

  const count = isLoading ? planCount : plans.length;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden max-w-[480px]">
      {/* 头部：提示文字 */}
      <div className="px-4 pt-4 pb-3">
        <p className="text-sm text-gray-700 leading-relaxed">
          {isLoading
            ? `正在为你生成 ${count} 篇选题计划…`
            : `根据你的需求，我准备了 ${count} 篇选题计划。`}
        </p>
      </div>

      {/* 计划卡片列表 */}
      <div className="px-4 pb-3 space-y-2">
        {isLoading
          ? Array.from({ length: planCount }).map((_, i) => <SkeletonCard key={i} />)
          : plans.map((plan, i) => (
              <div key={i} className="bg-gray-50 rounded-xl p-4">
                <p className="text-sm font-semibold text-gray-900 mb-2">
                  {i + 1}. {plan.title}
                </p>
                <div className="bg-white rounded-lg px-3 py-2.5 border border-gray-100">
                  <p className="text-xs text-gray-400 font-medium mb-1">摘要：</p>
                  <p className="text-xs text-gray-600 leading-relaxed">{plan.summary}</p>
                </div>
              </div>
            ))}
      </div>

      {/* 底部：提示 + 复选框 + 确认按钮 */}
      {!isLoading && (
        <div className="px-4 pb-4 border-t border-gray-50 pt-3">
          {!confirmed && (
            <p className="text-xs text-gray-500 mb-3">
              如果你满意这份计划，点击确认开始创作；如需修改，直接回复你的想法。
            </p>
          )}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={handleConfirm}
              disabled={confirmed || selectedTypes.length === 0}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                confirmed
                  ? 'bg-gray-200 text-gray-400 cursor-default'
                  : selectedTypes.length === 0
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-[#7678ee] text-white hover:bg-[#6a6cdc]'
              }`}
            >
              {confirmed ? '已确认' : '确认'}
            </button>

            <div className="flex items-center gap-3 flex-wrap">
              {CONTENT_TYPES.map(({ key, label, disabled }) => {
                const checked = selectedTypes.includes(key);
                return (
                  <label
                    key={key}
                    className={`flex items-center gap-1.5 cursor-pointer select-none ${
                      confirmed || disabled ? 'opacity-60 cursor-not-allowed' : ''
                    }`}
                    onClick={() => toggleType(key, disabled)}
                  >
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                        checked && !disabled
                          ? 'bg-[#7678ee] border-[#7678ee]'
                          : disabled
                          ? 'border-gray-200 bg-gray-100'
                          : 'border-gray-300 bg-white'
                      }`}
                    >
                      {checked && <Check size={10} className="text-white" strokeWidth={3} />}
                    </div>
                    <span className={`text-sm ${disabled ? 'text-gray-400' : 'text-gray-700'}`}>{label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DedePlanCard;
