import { useEffect, useState } from 'react';
import PageCard from '@/components/PageCard';
import PageErrorBoundary from '@/components/PageErrorBoundary';
import Toast from '@/components/Toast';
import { useActionFeedback } from '@/hooks/useActionFeedback';
import { fetchSystemConfig, saveSystemConfig } from '@/services/adminService';
import type { SystemConfig } from '@/shared/types/admin';
import styles from './PageLayout.module.css';

export default function SystemPage() {
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { feedback, showFeedback, closeFeedback } = useActionFeedback();

  useEffect(() => {
    fetchSystemConfig().then((payload) => {
      setConfig(payload);
    });
  }, []);

  const handleSave = async () => {
    if (!config) {
      return;
    }

    setIsSubmitting(true);
    const isSuccess = await saveSystemConfig(config);
    setIsSubmitting(false);

    if (!isSuccess) {
      showFeedback('error', '系统配置保存失败，请稍后重试');
      return;
    }

    showFeedback('success', '系统配置已更新');
  };

  return (
    <PageErrorBoundary>
      <div className={styles.grid}>
        <PageCard title="系统配置">
          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span className={styles.label}>Electron 数据同步间隔（秒）</span>
              <input
                className={styles.input}
                type="number"
                min={5}
                value={config?.electronDataPushIntervalSeconds ?? 20}
                onChange={(event) =>
                  setConfig((previous) =>
                    previous
                      ? {
                          ...previous,
                          electronDataPushIntervalSeconds: Number(event.target.value),
                        }
                      : previous
                  )
                }
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>WebSocket 心跳间隔（秒）</span>
              <input
                className={styles.input}
                type="number"
                min={5}
                value={config?.websocketHeartbeatSeconds ?? 30}
                onChange={(event) =>
                  setConfig((previous) =>
                    previous
                      ? {
                          ...previous,
                          websocketHeartbeatSeconds: Number(event.target.value),
                        }
                      : previous
                  )
                }
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>维护模式</span>
              <select
                className={styles.select}
                value={config?.isMaintenanceMode ? 'on' : 'off'}
                onChange={(event) =>
                  setConfig((previous) =>
                    previous
                      ? {
                          ...previous,
                          isMaintenanceMode: event.target.value === 'on',
                        }
                      : previous
                  )
                }
              >
                <option value="off">关闭</option>
                <option value="on">开启</option>
              </select>
            </label>

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={handleSave}
                disabled={isSubmitting || !config}
              >
                {isSubmitting ? '保存中...' : '保存配置'}
              </button>
            </div>

            <p className={styles.note}>
              配置保存后请确保 Electron 客户端按固定周期拉取更新，避免配置延迟生效。
            </p>
          </div>
        </PageCard>
      </div>

      <Toast
        type={feedback.type}
        message={feedback.message}
        isVisible={feedback.isVisible}
        onClose={closeFeedback}
      />
    </PageErrorBoundary>
  );
}
