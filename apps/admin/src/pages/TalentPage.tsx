import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import PageCard from '@/components/PageCard';
import PageErrorBoundary from '@/components/PageErrorBoundary';
import Toast from '@/components/Toast';
import Toggle from '@/components/Toggle';
import Modal from '@/components/Modal';
import AgentFormModal from '@/components/AgentFormModal';
import { useActionFeedback } from '@/hooks/useActionFeedback';
import {
  createAgent,
  deleteAgent,
  fetchAgents,
  fetchApiConfigs,
  updateAgent,
  updateAgentSkills,
} from '@/services/adminService';
import type { Agent, ModelProviderConfig } from '@/shared/types/admin';
import { appEnv } from '@/config';
import styles from './PageLayout.module.css';

const PAGE_SIZE = 15;
const IMPORT_JSON_PLACEHOLDER = `支持单条对象或数组：
{
  "name": "张三",
  "role": "前端工程师",
  "description": "8年 Web 开发经验",
  "prompt": "你是一位资深前端工程师...",
  "skills": ["React", "TypeScript", "性能优化"]
}

[
  {
    "name": "李四",
    "role": "产品经理",
    "description": "擅长 B 端产品设计",
    "prompt": "你是一位资深产品经理...",
    "skills": "需求分析、流程设计"
  }
]`;

interface ImportAgentItem {
  name: string;
  role: string;
  description?: string;
  prompt?: string;
  skills?: string;
}

interface ParseImportResult {
  items: ImportAgentItem[];
  errors: string[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeOptionalText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeSkills = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    return normalizeOptionalText(value);
  }

  if (Array.isArray(value)) {
    const textList = value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item) => item.length > 0);
    return textList.length > 0 ? textList.join('、') : undefined;
  }

  return undefined;
};

const parseImportItem = (item: unknown, index: number): { parsed?: ImportAgentItem; error?: string } => {
  if (!isRecord(item)) {
    return { error: `第 ${index + 1} 条必须是对象` };
  }

  const name = normalizeOptionalText(item.name);
  const role = normalizeOptionalText(item.role);

  if (!name) {
    return { error: `第 ${index + 1} 条缺少有效的 name(昵称)` };
  }

  if (!role) {
    return { error: `第 ${index + 1} 条缺少有效的 role(岗位)` };
  }

  return {
    parsed: {
      name,
      role,
      description: normalizeOptionalText(item.description),
      prompt: normalizeOptionalText(item.prompt),
      skills: normalizeSkills(item.skills),
    },
  };
};

const parseImportJsonText = (text: string): ParseImportResult => {
  try {
    const parsedJson: unknown = JSON.parse(text);
    const sourceItems = Array.isArray(parsedJson) ? parsedJson : [parsedJson];

    if (sourceItems.length === 0) {
      return { items: [], errors: ['JSON 数组不能为空'] };
    }

    const items: ImportAgentItem[] = [];
    const errors: string[] = [];

    sourceItems.forEach((item, index) => {
      const result = parseImportItem(item, index);
      if (result.error) {
        errors.push(result.error);
        return;
      }
      if (result.parsed) {
        items.push(result.parsed);
      }
    });

    return { items, errors };
  } catch (error) {
    return {
      items: [],
      errors: [`JSON 格式错误: ${error instanceof Error ? error.message : '解析失败'}`],
    };
  }
};

function normalizeAvatar(avatar: string | null | undefined): string | undefined {
  if (!avatar) return undefined;
  // 去掉多余的 /public 前缀
  const path = avatar.startsWith('/public/') ? avatar.slice('/public'.length) : avatar;
  // 相对路径（/xxx.webp）需要拼上 api-server origin，否则 admin 端口下找不到图片
  if (path.startsWith('/')) return `${appEnv.apiBaseUrl}${path}`;
  return path;
}

export default function TalentPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [models, setModels] = useState<ModelProviderConfig[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; agent: Agent | null }>({ isOpen: false, agent: null });
  const [isDeleting, setIsDeleting] = useState(false);
  const [skillsModal, setSkillsModal] = useState<{ isOpen: boolean; agent: Agent | null }>({ isOpen: false, agent: null });
  const [skillsText, setSkillsText] = useState('');
  const [isSavingSkills, setIsSavingSkills] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedAgentIds, setSelectedAgentIds] = useState<Set<string>>(new Set());
  const [isBatchDeleteModalOpen, setIsBatchDeleteModalOpen] = useState(false);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const { feedback, showFeedback, closeFeedback } = useActionFeedback();

  const loadData = async () => {
    const [agentsData, modelsData] = await Promise.all([fetchAgents(), fetchApiConfigs()]);
    setAgents(agentsData);
    setModels(modelsData);
    setSelectedAgentIds((prev) => {
      if (prev.size === 0) {
        return prev;
      }

      const validIdSet = new Set(agentsData.map((agent) => agent.agentId));
      return new Set(Array.from(prev).filter((agentId) => validIdSet.has(agentId)));
    });
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = () => {
    setEditingAgent(null);
    setModalMode('create');
    setIsModalOpen(true);
  };

  const handleImportOpen = () => {
    setImportJsonText('');
    setIsImportModalOpen(true);
  };

  const handleImportClose = () => {
    if (isImporting) {
      return;
    }
    setIsImportModalOpen(false);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingAgent(null);
  };

  const handleEdit = (agent: Agent) => {
    setModalMode('edit');
    setEditingAgent(agent);
    setIsModalOpen(true);
  };

  const handleDeleteClick = (agent: Agent) => {
    setDeleteModal({ isOpen: true, agent });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteModal.agent) return;

    try {
      setIsDeleting(true);
      const isSuccess = await deleteAgent(deleteModal.agent.agentId);
      if (!isSuccess) {
        showFeedback('error', '删除失败，请稍后重试');
        return;
      }

      showFeedback('success', '人才已删除');
      setAgents((prev) => prev.filter((item) => item.agentId !== deleteModal.agent!.agentId));
      setSelectedAgentIds((prev) => {
        if (!prev.has(deleteModal.agent!.agentId)) {
          return prev;
        }

        const next = new Set(prev);
        next.delete(deleteModal.agent!.agentId);
        return next;
      });
      setDeleteModal({ isOpen: false, agent: null });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBatchDeleteOpen = () => {
    if (selectedAgentIds.size === 0) {
      return;
    }
    setIsBatchDeleteModalOpen(true);
  };

  const handleBatchDeleteClose = () => {
    if (isBatchDeleting) {
      return;
    }
    setIsBatchDeleteModalOpen(false);
  };

  const handleBatchDeleteConfirm = async () => {
    const targetIds = Array.from(selectedAgentIds);
    if (targetIds.length === 0) {
      showFeedback('error', '请先勾选要删除的人才');
      return;
    }

    setIsBatchDeleting(true);

    const deletedIdSet = new Set<string>();
    const failedNameList: string[] = [];

    try {
      for (const agentId of targetIds) {
        const isSuccess = await deleteAgent(agentId);
        if (isSuccess) {
          deletedIdSet.add(agentId);
          continue;
        }

        const failedAgent = agents.find((item) => item.agentId === agentId);
        failedNameList.push(failedAgent?.name ?? agentId);
      }

      if (deletedIdSet.size > 0) {
        setAgents((prev) => prev.filter((item) => !deletedIdSet.has(item.agentId)));
        setSelectedAgentIds((prev) =>
          new Set(Array.from(prev).filter((agentId) => !deletedIdSet.has(agentId)))
        );
      }

      if (failedNameList.length === 0) {
        showFeedback('success', `已删除 ${deletedIdSet.size} 个人才`);
        setIsBatchDeleteModalOpen(false);
        return;
      }

      showFeedback(
        'error',
        `批量删除完成：成功 ${deletedIdSet.size} 条，失败 ${failedNameList.length} 条（例如：${failedNameList[0]}）`
      );
    } finally {
      setIsBatchDeleting(false);
    }
  };

  const handleRowSelectChange = (agentId: string, checked: boolean) => {
    setSelectedAgentIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(agentId);
      } else {
        next.delete(agentId);
      }
      return next;
    });
  };

  const handlePageSelectChange = (pageAgents: Agent[], checked: boolean) => {
    setSelectedAgentIds((prev) => {
      const next = new Set(prev);
      pageAgents.forEach((agent) => {
        if (checked) {
          next.add(agent.agentId);
        } else {
          next.delete(agent.agentId);
        }
      });
      return next;
    });
  };

  const handleSkillsClick = (agent: Agent) => {
    setSkillsText(agent.skills ?? '');
    setSkillsModal({ isOpen: true, agent });
  };

  const handleSkillsSave = async () => {
    if (!skillsModal.agent) return;
    setIsSavingSkills(true);
    try {
      const isSuccess = await updateAgentSkills(skillsModal.agent.agentId, skillsText);
      if (!isSuccess) {
        showFeedback('error', '保存失败，请稍后重试');
        return;
      }
      setAgents((prev) =>
        prev.map((item) =>
          item.agentId === skillsModal.agent!.agentId ? { ...item, skills: skillsText } : item
        )
      );
      showFeedback('success', '技能已保存');
      setSkillsModal({ isOpen: false, agent: null });
    } finally {
      setIsSavingSkills(false);
    }
  };

  const handleToggle = async (agent: Agent) => {
    const isSuccess = await updateAgent(agent.agentId, {
      isListed: !agent.isListed,
    });

    if (!isSuccess) {
      showFeedback('error', '状态更新失败');
      return;
    }

    setAgents((prev) =>
      prev.map((item) =>
        item.agentId === agent.agentId ? { ...item, isListed: !item.isListed } : item
      )
    );
  };

  const handleSubmit = async (formData: {
    name: string;
    avatar: string;
    role: string;
    description: string;
    prompt: string;
    priceRate: number;
    priceUnit: string;
    modelId: string;
    isListed: boolean;
  }) => {
    if (modalMode === 'create') {
      const isSuccess = await createAgent({
        ...formData,
        avatar: formData.avatar || undefined,
        description: formData.description || undefined,
        prompt: formData.prompt || undefined,
        modelId: formData.modelId || undefined,
      });

      if (!isSuccess) {
        showFeedback('error', '创建失败，请检查参数或后台服务');
        return;
      }

      showFeedback('success', '人才创建成功');
      await loadData();
    } else {
      if (!editingAgent) return;

      const isSuccess = await updateAgent(editingAgent.agentId, {
        name: formData.name,
        avatar: formData.avatar || null,
        role: formData.role,
        description: formData.description || null,
        prompt: formData.prompt || null,
        priceRate: formData.priceRate,
        priceUnit: formData.priceUnit,
        modelId: formData.modelId || null,
        isListed: formData.isListed,
      });

      if (!isSuccess) {
        showFeedback('error', '更新失败，请检查参数或后台服务');
        return;
      }

      showFeedback('success', '人才更新成功');
      await loadData();
    }

    handleCloseModal();
  };

  const handleImportSubmit = async () => {
    const jsonText = importJsonText.trim();
    if (!jsonText) {
      showFeedback('error', '请先粘贴 JSON 数据');
      return;
    }

    const parseResult = parseImportJsonText(jsonText);
    if (parseResult.errors.length > 0) {
      showFeedback('error', `导入数据校验失败：${parseResult.errors[0]}`);
      return;
    }

    const enabledLlmModels = models.filter((model) => model.isEnabled && model.apiType === 'llm');
    const defaultModelId = enabledLlmModels[0]?.customId;

    if (!defaultModelId) {
      showFeedback('error', '暂无可用的 LLM 模型，请先在 API 管理里启用至少一个 LLM');
      return;
    }

    const existingNameSet = new Set(
      agents.map((agent) => agent.name.trim().toLocaleLowerCase())
    );
    const importedNameSet = new Set<string>();
    const validItems: ImportAgentItem[] = [];
    const failureReasons: string[] = [];

    parseResult.items.forEach((item, index) => {
      const normalizedName = item.name.trim().toLocaleLowerCase();

      if (existingNameSet.has(normalizedName)) {
        failureReasons.push(`第 ${index + 1} 条「${item.name}」与现有人才重名`);
        return;
      }

      if (importedNameSet.has(normalizedName)) {
        failureReasons.push(`第 ${index + 1} 条「${item.name}」与本次导入数据重名`);
        return;
      }

      importedNameSet.add(normalizedName);
      validItems.push(item);
    });

    if (validItems.length === 0) {
      const firstReason = failureReasons[0] ?? '没有可导入的数据';
      showFeedback('error', `导入失败：${firstReason}`);
      return;
    }

    setIsImporting(true);
    let successCount = 0;

    try {
      for (let index = 0; index < validItems.length; index += 1) {
        const item = validItems[index];
        const created = await createAgent({
          name: item.name,
          role: item.role,
          description: item.description,
          prompt: item.prompt,
          skills: item.skills,
          modelId: defaultModelId,
          isListed: true,
          priceRate: 1.0,
          priceUnit: 'hour',
        });

        if (created) {
          successCount += 1;
          continue;
        }

        failureReasons.push(`第 ${index + 1} 条「${item.name}」创建失败`);
      }

      if (successCount > 0) {
        await loadData();
      }

      const failedCount = failureReasons.length;
      if (failedCount === 0) {
        showFeedback('success', `导入完成：成功 ${successCount} 条`);
        setIsImportModalOpen(false);
        setImportJsonText('');
        return;
      }

      showFeedback(
        'error',
        `导入完成：成功 ${successCount} 条，失败 ${failedCount} 条。${failureReasons[0]}`
      );
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <PageErrorBoundary>
      <div className={styles.grid}>
        <PageCard title="人才市场管理">
          <div className="mb-4 flex items-center gap-2">
            <button
              type="button"
              onClick={handleCreate}
              className="flex items-center gap-2 px-4 py-2 bg-[#2C2D33] text-white rounded-lg text-sm font-medium hover:bg-[#1a1b1f] transition-colors"
            >
              <Plus size={16} />
              添加人才
            </button>
            <button
              type="button"
              onClick={handleImportOpen}
              className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              导入 JSON
            </button>
            <button
              type="button"
              onClick={handleBatchDeleteOpen}
              disabled={selectedAgentIds.size === 0}
              className="px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              批量删除
            </button>
            {selectedAgentIds.size > 0 && (
              <span className="text-xs text-gray-500">已勾选 {selectedAgentIds.size} 条</span>
            )}
          </div>

          {(() => {
            const totalPages = Math.max(1, Math.ceil(agents.length / PAGE_SIZE));
            const safePage = Math.min(currentPage, totalPages);
            const pageAgents = agents.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
            const selectedCountInPage = pageAgents.filter((agent) =>
              selectedAgentIds.has(agent.agentId)
            ).length;
            const isAllSelectedInPage =
              pageAgents.length > 0 && selectedCountInPage === pageAgents.length;
            return (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left text-xs text-gray-600 py-3 px-3 w-10">
                          <input
                            type="checkbox"
                            checked={isAllSelectedInPage}
                            onChange={(event) =>
                              handlePageSelectChange(pageAgents, event.currentTarget.checked)
                            }
                            aria-label="全选当前页"
                          />
                        </th>
                        <th className="text-left text-xs text-gray-600 py-3 px-3">头像</th>
                        <th className="text-left text-xs text-gray-600 py-3 px-3">昵称</th>
                        <th className="text-left text-xs text-gray-600 py-3 px-3">岗位</th>
                        <th className="text-left text-xs text-gray-600 py-3 px-3">倍率/小时</th>
                        <th className="text-left text-xs text-gray-600 py-3 px-3">模型</th>
                        <th className="text-left text-xs text-gray-600 py-3 px-3">上架</th>
                        <th className="text-left text-xs text-gray-600 py-3 px-3">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agents.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="text-center py-8 text-gray-400 text-sm">
                            暂无人才数据，点击上方按钮添加
                          </td>
                        </tr>
                      ) : (
                        pageAgents.map((agent) => {
                          const avatarSrc = normalizeAvatar(agent.avatar);
                          const isSelected = selectedAgentIds.has(agent.agentId);
                          return (
                            <tr
                              key={agent.agentId}
                              className={`border-b border-gray-100 hover:bg-gray-50 ${
                                isSelected ? 'bg-red-50/40' : ''
                              }`}
                            >
                              <td className="py-3 px-3">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(event) =>
                                    handleRowSelectChange(agent.agentId, event.currentTarget.checked)
                                  }
                                  aria-label={`选择人才 ${agent.name}`}
                                />
                              </td>
                              <td className="py-3 px-3">
                                {avatarSrc ? (
                                  <img
                                    src={avatarSrc}
                                    alt={agent.name}
                                    className="w-10 h-10 rounded-full object-cover"
                                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-sm font-medium">
                                    {agent.name.charAt(0)}
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-3 text-sm text-gray-700 font-medium">{agent.name}</td>
                              <td className="py-3 px-3 text-sm text-gray-700">{agent.role}</td>
                              <td className="py-3 px-3 text-sm text-gray-700">
                                {agent.priceRate.toFixed(1)}x
                              </td>
                              <td className="py-3 px-3 text-sm text-gray-700">
                                {agent.modelId ? (
                                  <span className="text-blue-600">{agent.modelId}</span>
                                ) : (
                                  <span className="text-gray-400">未绑定</span>
                                )}
                              </td>
                              <td className="py-3 px-3">
                                <Toggle checked={agent.isListed} onChange={() => handleToggle(agent)} />
                              </td>
                              <td className="py-3 px-3">
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleEdit(agent)}
                                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                                  >
                                    编辑
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSkillsClick(agent)}
                                    className="text-xs text-emerald-600 hover:text-emerald-800 font-medium"
                                  >
                                    技能
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteClick(agent)}
                                    className="text-xs text-red-600 hover:text-red-800 font-medium flex items-center gap-1"
                                  >
                                    <Trash2 size={12} />
                                    删除
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* 翻页控件 */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                    <span className="text-xs text-gray-500">
                      共 {agents.length} 条，第 {safePage} / {totalPages} 页
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setCurrentPage(1)}
                        disabled={safePage === 1}
                        className="px-2 py-1 text-xs rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
                      >
                        «
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={safePage === 1}
                        className="px-2 py-1 text-xs rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
                      >
                        ‹
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter((p) => Math.abs(p - safePage) <= 2)
                        .map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setCurrentPage(p)}
                            className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                              p === safePage
                                ? 'bg-[#2C2D33] text-white border-[#2C2D33]'
                                : 'border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            {p}
                          </button>
                        ))}
                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={safePage === totalPages}
                        className="px-2 py-1 text-xs rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
                      >
                        ›
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={safePage === totalPages}
                        className="px-2 py-1 text-xs rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
                      >
                        »
                      </button>
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </PageCard>
      </div>

      <AgentFormModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleSubmit}
        initialData={editingAgent}
        models={models}
        mode={modalMode}
      />

      {/* 技能编辑弹窗 */}
      {skillsModal.isOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setSkillsModal({ isOpen: false, agent: null }); }}
        >
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: 620, maxWidth: '90vw', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: '#111827' }}>
              技能设置
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#6b7280' }}>
              {skillsModal.agent?.name} · {skillsModal.agent?.role}
            </p>
            <textarea
              value={skillsText}
              onChange={(e) => setSkillsText(e.target.value)}
              placeholder="在此输入该人才的技能描述、专业领域、擅长方向等，后续将作为 AI 上下文使用..."
              style={{
                width: '100%', minHeight: 400, padding: '12px 14px',
                border: '1px solid #e5e7eb', borderRadius: 10,
                fontSize: 13, lineHeight: 1.7, resize: 'vertical',
                fontFamily: 'inherit', color: '#111827', boxSizing: 'border-box',
                outline: 'none',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#ff6154'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; }}
              autoFocus
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <button
                type="button"
                onClick={() => setSkillsModal({ isOpen: false, agent: null })}
                style={{ padding: '8px 18px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', fontSize: 13, cursor: 'pointer', color: '#374151' }}
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSkillsSave}
                disabled={isSavingSkills}
                style={{ padding: '8px 18px', borderRadius: 10, border: 0, background: '#111827', color: '#fff', fontSize: 13, cursor: isSavingSkills ? 'not-allowed' : 'pointer', opacity: isSavingSkills ? 0.6 : 1 }}
              >
                {isSavingSkills ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Modal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, agent: null })}
        title="确认删除人才"
        onConfirm={handleDeleteConfirm}
        confirmText="删除"
        cancelText="取消"
        confirmButtonVariant="danger"
        isSubmitting={isDeleting}
      >
        <p className="mb-2">
          确定要删除人才 <strong>{deleteModal.agent?.name}</strong> 吗？
        </p>
        <p className="text-gray-500 text-xs">
          岗位: {deleteModal.agent?.role}
        </p>
        <p className="mt-4 text-red-600 font-medium">此操作不可恢复！</p>
      </Modal>

      <Modal
        isOpen={isBatchDeleteModalOpen}
        onClose={handleBatchDeleteClose}
        title="确认批量删除人才"
        onConfirm={handleBatchDeleteConfirm}
        confirmText="批量删除"
        cancelText="取消"
        confirmButtonVariant="danger"
        isSubmitting={isBatchDeleting}
      >
        <p className="mb-2">
          确定要删除已勾选的 <strong>{selectedAgentIds.size}</strong> 个人才吗？
        </p>
        <p className="text-gray-500 text-xs">删除后不可恢复，请谨慎操作。</p>
      </Modal>

      <Modal
        isOpen={isImportModalOpen}
        onClose={handleImportClose}
        title="导入 JSON 人才"
        onConfirm={handleImportSubmit}
        confirmText="校验并导入"
        cancelText="取消"
        isSubmitting={isImporting}
      >
        <p className="text-xs text-gray-500 mb-3">
          支持单条对象或数组。字段需包含 name(昵称)、role(岗位)，description/prompt/skills 可选。skills 支持字符串或字符串数组。
        </p>
        <textarea
          className={`${styles.input} ${styles.textareaLarge} ${styles.inputFullWidth}`}
          value={importJsonText}
          onChange={(event) => setImportJsonText(event.target.value)}
          placeholder={IMPORT_JSON_PLACEHOLDER}
          rows={14}
          disabled={isImporting}
        />
      </Modal>

      <Toast
        type={feedback.type}
        message={feedback.message}
        isVisible={feedback.isVisible}
        onClose={closeFeedback}
      />
    </PageErrorBoundary>
  );
}
