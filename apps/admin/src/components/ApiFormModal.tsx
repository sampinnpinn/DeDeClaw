import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import Modal from '@/components/Modal';
import Toggle from '@/components/Toggle';
import type { ApiType, CustomParam, ModelProviderConfig } from '@/shared/types/admin';
import styles from '@/pages/PageLayout.module.css';

interface ApiFormData {
  customId: string;
  apiType: ApiType;
  baseUrl: string;
  modelName: string;
  apiKey: string;
  customParams: CustomParam[];
  isEnabled: boolean;
}

interface ApiFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ApiFormData) => Promise<void>;
  initialData?: ModelProviderConfig | null;
  mode: 'create' | 'edit';
}

const apiTypeOptions: { value: ApiType; label: string }[] = [
  { value: 'llm', label: 'LLM 大语言模型' },
  { value: 'image', label: '图片生成' },
  { value: 'video', label: '视频生成' },
  { value: 'vector', label: '向量嵌入' },
];

const buildFormData = (
  mode: 'create' | 'edit',
  initialData?: ModelProviderConfig | null
): ApiFormData => {
  if (mode === 'create') {
    return {
      customId: '',
      apiType: 'llm',
      baseUrl: '',
      modelName: '',
      apiKey: '',
      customParams: [],
      isEnabled: true,
    };
  }

  // 编辑模式：回填所有字段（apiKey 除外，因为后端只返回脱敏的 apiKeyMasked）
  return {
    customId: initialData?.customId ?? '',
    apiType: initialData?.apiType ?? 'llm',
    baseUrl: initialData?.baseUrl ?? '',
    modelName: initialData?.modelName ?? '',
    apiKey: '', // 编辑时留空，用户需要时手动输入新密钥
    customParams: initialData?.customParams ?? [],
    isEnabled: initialData?.isEnabled ?? true,
  };
};

export default function ApiFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  mode,
}: ApiFormModalProps) {
  const [form, setForm] = useState<ApiFormData>({
    customId: '',
    apiType: 'llm',
    baseUrl: '',
    modelName: '',
    apiKey: '',
    customParams: [],
    isEnabled: true,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm(buildFormData(mode, initialData));
    }
  }, [isOpen, mode, initialData]);

  const handleAddParam = () => {
    setForm((prev) => ({
      ...prev,
      customParams: [...prev.customParams, { key: '', value: '' }],
    }));
  };

  const handleRemoveParam = (index: number) => {
    setForm((prev) => ({
      ...prev,
      customParams: prev.customParams.filter((_, i) => i !== index),
    }));
  };

  const handleParamChange = (index: number, field: 'key' | 'value', value: string) => {
    setForm((prev) => ({
      ...prev,
      customParams: prev.customParams.map((param, i) =>
        i === index ? { ...param, [field]: value } : param
      ),
    }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onSubmit(form);
    } catch (error) {
      console.error('API 提交失败:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'create' ? '创建新 API' : '编辑 API 配置'}
      onConfirm={handleSubmit}
      confirmText={mode === 'create' ? '创建' : '保存'}
      isSubmitting={isSubmitting}
    >
      <div className={styles.formGrid}>
        <label className={styles.field}>
          <span className={styles.label}>自定义 ID *</span>
          <input
            className={styles.input}
            value={form.customId}
            onChange={(e) => setForm((prev) => ({ ...prev, customId: e.target.value }))}
            placeholder="例如：openai-gpt4、claude-sonnet"
            autoComplete="off"
            required
          />
          <p className={styles.note}>前端调用时用于识别此模型的唯一标识</p>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>API 类型 *</span>
          <select
            className={styles.select}
            value={form.apiType}
            onChange={(e) => setForm((prev) => ({ ...prev, apiType: e.target.value as ApiType }))}
          >
            {apiTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Base URL *</span>
          <input
            className={styles.input}
            value={form.baseUrl}
            onChange={(e) => setForm((prev) => ({ ...prev, baseUrl: e.target.value }))}
            placeholder="https://api.openai.com/v1"
            autoComplete="off"
            required
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>模型名称 *</span>
          <input
            className={styles.input}
            value={form.modelName}
            onChange={(e) => setForm((prev) => ({ ...prev, modelName: e.target.value }))}
            placeholder="gpt-4.1-mini"
            autoComplete="off"
            required
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>API Key {mode === 'edit' && '（留空则不修改）'}</span>
          <input
            className={styles.input}
            type="password"
            value={form.apiKey}
            onChange={(e) => setForm((prev) => ({ ...prev, apiKey: e.target.value }))}
            placeholder={mode === 'create' ? '必填' : '●●●●●●●● 已有密钥，输入将覆盖'}
            autoComplete="new-password"
            required={mode === 'create'}
          />
        </label>

        <div className={styles.field}>
          <div className="flex items-center justify-between mb-2">
            <span className={styles.label}>自定义参数</span>
            <button
              type="button"
              onClick={handleAddParam}
              className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 transition-colors"
            >
              <Plus size={14} />
              添加参数
            </button>
          </div>

          {form.customParams.length === 0 ? (
            <p className={styles.note}>暂无自定义参数</p>
          ) : (
            <div className="space-y-2">
              {form.customParams.map((param, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <input
                    className={`${styles.input} flex-1`}
                    value={param.key}
                    onChange={(e) => handleParamChange(index, 'key', e.target.value)}
                    placeholder="参数名"
                  />
                  <input
                    className={`${styles.input} flex-1`}
                    value={param.value}
                    onChange={(e) => handleParamChange(index, 'value', e.target.value)}
                    placeholder="参数值"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveParam(index)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.field}>
          <div className="flex items-center justify-between">
            <span className={styles.label}>启用状态</span>
            <Toggle
              checked={form.isEnabled}
              onChange={(checked) => setForm((prev) => ({ ...prev, isEnabled: checked }))}
            />
          </div>
          <p className={styles.note}>{form.isEnabled ? '当前已启用' : '当前已停用'}</p>
        </div>
      </div>
    </Modal>
  );
}
