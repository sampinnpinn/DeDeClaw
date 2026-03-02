import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import PageCard from '@/components/PageCard';
import PageErrorBoundary from '@/components/PageErrorBoundary';
import Toast from '@/components/Toast';
import Toggle from '@/components/Toggle';
import Modal from '@/components/Modal';
import ApiFormModal from '@/components/ApiFormModal';
import { useActionFeedback } from '@/hooks/useActionFeedback';
import { createApiConfig, deleteApiConfig, fetchApiConfigs, updateApiConfig } from '@/services/adminService';
import type { ModelProviderConfig } from '@/shared/types/admin';
import styles from './PageLayout.module.css';

const apiTypeLabels: Record<string, string> = {
  llm: 'LLM',
  image: '图片',
  video: '视频',
  vector: '向量',
};

interface TableColumn<T> {
  key: keyof T | string;
  title: string;
  render: (item: T) => string | React.ReactElement;
}

export default function ApiPage() {
  const [configs, setConfigs] = useState<ModelProviderConfig[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingConfig, setEditingConfig] = useState<ModelProviderConfig | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; config: ModelProviderConfig | null }>({ isOpen: false, config: null });
  const [isDeleting, setIsDeleting] = useState(false);
  const { feedback, showFeedback, closeFeedback } = useActionFeedback();

  const loadConfigs = async () => {
    const payload = await fetchApiConfigs();
    setConfigs(payload);
  };

  useEffect(() => {
    loadConfigs();
  }, []);

  const handleCreate = () => {
    setEditingConfig(null);
    setModalMode('create');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingConfig(null);
  };

  const handleEdit = (config: ModelProviderConfig) => {
    setModalMode('edit');
    setEditingConfig(config);
    setIsModalOpen(true);
  };

  const handleDeleteClick = (config: ModelProviderConfig) => {
    setDeleteModal({ isOpen: true, config });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteModal.config) return;

    try {
      setIsDeleting(true);
      const isSuccess = await deleteApiConfig(deleteModal.config.providerId);
      if (!isSuccess) {
        showFeedback('error', '删除失败，请稍后重试');
        return;
      }

      showFeedback('success', 'API 配置已删除');
      setConfigs((prev) => prev.filter((item) => item.providerId !== deleteModal.config!.providerId));
      setDeleteModal({ isOpen: false, config: null });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggle = async (config: ModelProviderConfig) => {
    const isSuccess = await updateApiConfig(config.providerId, {
      customId: config.customId,
      apiType: config.apiType,
      baseUrl: config.baseUrl,
      modelName: config.modelName,
      customParams: config.customParams,
      isEnabled: !config.isEnabled,
    });

    if (!isSuccess) {
      showFeedback('error', '状态更新失败');
      return;
    }

    setConfigs((prev) =>
      prev.map((item) =>
        item.providerId === config.providerId ? { ...item, isEnabled: !item.isEnabled } : item
      )
    );
  };

  const handleSubmit = async (formData: {
    customId: string;
    apiType: string;
    baseUrl: string;
    modelName: string;
    apiKey: string;
    customParams: { key: string; value: string }[];
    isEnabled: boolean;
  }) => {
    if (modalMode === 'create') {
      const isSuccess = await createApiConfig(formData);
      if (!isSuccess) {
        showFeedback('error', '创建失败，请检查参数或后台服务');
        return;
      }

      showFeedback('success', 'API 配置创建成功');
      await loadConfigs();
    } else {
      if (!editingConfig) return;

      const isSuccess = await updateApiConfig(editingConfig.providerId, formData);
      if (!isSuccess) {
        showFeedback('error', '更新失败，请检查参数或后台服务');
        return;
      }

      showFeedback('success', 'API 配置更新成功');
      await loadConfigs();
    }

    handleCloseModal();
  };

  const columns: TableColumn<ModelProviderConfig>[] = [
    { key: 'customId', title: '自定义 ID', render: (item) => item.customId },
    { key: 'apiType', title: '类型', render: (item) => apiTypeLabels[item.apiType] ?? item.apiType },
    { key: 'modelName', title: '模型', render: (item) => item.modelName },
    { key: 'updatedAt', title: '更新时间', render: (item) => item.updatedAt },
  ];


  return (
    <PageErrorBoundary>
      <div className={styles.grid}>
        <PageCard title="API 配置列表">
          <div className="mb-4">
            <button
              type="button"
              onClick={handleCreate}
              className="flex items-center gap-2 px-4 py-2 bg-[#2C2D33] text-white rounded-lg text-sm font-medium hover:bg-[#1a1b1f] transition-colors"
            >
              <Plus size={16} />
              创建新 API
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  {columns.map((col) => (
                    <th key={String(col.key)} className="text-left text-xs text-gray-600 py-3 px-3">
                      {col.title}
                    </th>
                  ))}
                  <th className="text-left text-xs text-gray-600 py-3 px-3">启用</th>
                  <th className="text-left text-xs text-gray-600 py-3 px-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {configs.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length + 1} className="text-center py-8 text-gray-400 text-sm">
                      暂无 API 配置，点击上方按钮创建
                    </td>
                  </tr>
                ) : (
                  configs.map((config) => (
                    <tr key={config.providerId} className="border-b border-gray-100 hover:bg-gray-50">
                      {columns.map((col) => (
                        <td key={String(col.key)} className="py-3 px-3 text-sm text-gray-700">
                          {col.render(config)}
                        </td>
                      ))}
                      <td className="py-3 px-3">
                        <Toggle
                          checked={config.isEnabled}
                          onChange={() => handleToggle(config)}
                        />
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(config)}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                          >
                            编辑
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteClick(config)}
                            className="text-xs text-red-600 hover:text-red-800 font-medium flex items-center gap-1"
                          >
                            <Trash2 size={12} />
                            删除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </PageCard>
      </div>

      <ApiFormModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleSubmit}
        initialData={editingConfig}
        mode={modalMode}
      />

      <Modal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, config: null })}
        title="确认删除 API 配置"
        onConfirm={handleDeleteConfirm}
        confirmText="删除"
        cancelText="取消"
        confirmButtonVariant="danger"
        isSubmitting={isDeleting}
      >
        <p className="mb-2">
          确定要删除 API 配置 <strong>{deleteModal.config?.customId}</strong> 吗？
        </p>
        <p className="text-gray-500 text-xs">
          类型: {deleteModal.config?.apiType}
          <br />
          模型: {deleteModal.config?.modelName}
        </p>
        <p className="mt-4 text-red-600 font-medium">此操作不可恢复！</p>
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
