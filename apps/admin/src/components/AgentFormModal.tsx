import { useEffect, useState } from 'react';
import Modal from '@/components/Modal';
import Toggle from '@/components/Toggle';
import ImageUpload from '@/components/ImageUpload';
import type { Agent, ModelProviderConfig } from '@/shared/types/admin';
import styles from '@/pages/PageLayout.module.css';

interface AgentFormData {
  name: string;
  avatar: string;
  role: string;
  description: string;
  prompt: string;
  priceRate: number;
  priceUnit: string;
  modelId: string;
  isListed: boolean;
}

interface AgentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: AgentFormData) => Promise<void>;
  initialData?: Agent | null;
  models: ModelProviderConfig[];
  mode: 'create' | 'edit';
}

const buildFormData = (
  mode: 'create' | 'edit',
  initialData?: Agent | null
): AgentFormData => {
  if (mode === 'create') {
    return {
      name: '',
      avatar: '',
      role: '',
      description: '',
      prompt: '',
      priceRate: 1.0,
      priceUnit: 'hour',
      modelId: '',
      isListed: false,
    };
  }

  return {
    name: initialData?.name ?? '',
    avatar: initialData?.avatar ?? '',
    role: initialData?.role ?? '',
    description: initialData?.description ?? '',
    prompt: initialData?.prompt ?? '',
    priceRate: initialData?.priceRate ?? 1.0,
    priceUnit: initialData?.priceUnit ?? 'hour',
    modelId: initialData?.modelId ?? '',
    isListed: initialData?.isListed ?? false,
  };
};

export default function AgentFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  models,
  mode,
}: AgentFormModalProps) {
  const [form, setForm] = useState<AgentFormData>(buildFormData(mode, initialData));
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm(buildFormData(mode, initialData));
    }
  }, [isOpen, mode, initialData]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onSubmit(form);
    } catch (error) {
      console.error('Agent 提交失败:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 过滤只显示已启用的 LLM 模型
  const enabledModels = models.filter((m) => m.isEnabled && m.apiType === 'llm');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'create' ? '添加新人才' : '编辑人才'}
      onConfirm={handleSubmit}
      confirmText={mode === 'create' ? '添加' : '保存'}
      isSubmitting={isSubmitting}
    >
      <div className={styles.formGrid}>
        <div className={styles.field}>
          <span className={styles.label}>头像</span>
          <ImageUpload
            value={form.avatar}
            onChange={(url) => setForm((prev) => ({ ...prev, avatar: url }))}
            disabled={isSubmitting}
          />
        </div>

        <label className={styles.field}>
          <span className={styles.label}>昵称 *</span>
          <input
            className={styles.input}
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="请输入昵称"
            autoComplete="off"
            required
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>岗位 *</span>
          <input
            className={styles.input}
            value={form.role}
            onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
            placeholder="例如：前端工程师、产品经理"
            autoComplete="off"
            required
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>简介</span>
          <textarea
            className={styles.input}
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="简要描述该人才的技能和特点"
            rows={3}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>提示词</span>
          <textarea
            className={`${styles.input} ${styles.textareaLarge}`}
            value={form.prompt}
            onChange={(e) => setForm((prev) => ({ ...prev, prompt: e.target.value }))}
            placeholder="请输入该 Agent 的系统提示词"
            rows={8}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>倍率 *</span>
          <input
            className={styles.input}
            type="number"
            step="0.1"
            min="0"
            value={form.priceRate}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, priceRate: parseFloat(e.target.value) || 0 }))
            }
            placeholder="1.0"
            required
          />
          <p className={styles.note}>每小时费率倍数</p>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>大模型</span>
          <select
            className={styles.select}
            value={form.modelId}
            onChange={(e) => setForm((prev) => ({ ...prev, modelId: e.target.value }))}
          >
            <option value="">不绑定模型</option>
            {enabledModels.map((model) => (
              <option key={model.customId} value={model.customId}>
                {model.customId}{model.modelName ? ` (${model.modelName})` : ''}
              </option>
            ))}
          </select>
          <p className={styles.note}>
            {enabledModels.length === 0
              ? '暂无可用的 LLM 模型，请先在 API 配置中添加'
              : '选择此人才使用的 AI 模型'}
          </p>
        </label>

        <div className={styles.field}>
          <div className="flex items-center justify-between">
            <span className={styles.label}>上架状态</span>
            <Toggle
              checked={form.isListed}
              onChange={(checked) => setForm((prev) => ({ ...prev, isListed: checked }))}
            />
          </div>
          <p className={styles.note}>
            {form.isListed ? '客户端可见，用户可以选择' : '客户端不可见'}
          </p>
        </div>
      </div>
    </Modal>
  );
}
