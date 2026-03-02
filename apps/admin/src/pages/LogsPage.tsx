import { useCallback, useEffect, useState } from 'react';
import DataTable, { type TableColumn } from '@/components/DataTable';
import PageCard from '@/components/PageCard';
import PageErrorBoundary from '@/components/PageErrorBoundary';
import { fetchLogs } from '@/services/adminService';
import type { ApiType, CallType, LogListFilter, LogRecord } from '@/shared/types/admin';
import styles from './PageLayout.module.css';

const API_TYPE_LABELS: Record<ApiType, string> = {
  llm: 'LLM 大语言模型',
  image: '图片生成',
  video: '视频生成',
  vector: '向量嵌入',
};

const CALL_TYPE_LABELS: Record<CallType, string> = {
  chat: '普通聊天',
  plan: '计划模式',
  rag_embed: 'RAG 向量化',
  memory: '记忆提取',
};

const PAGE_SIZE = 20;

export default function LogsPage() {
  const [logs, setLogs] = useState<LogRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const [filterCallType, setFilterCallType] = useState<CallType | ''>('');
  const [filterApiType, setFilterApiType] = useState<ApiType | ''>('');
  const [filterUserId, setFilterUserId] = useState('');
  const [filterModelId, setFilterModelId] = useState('');

  const load = useCallback(
    async (p: number, filter: LogListFilter) => {
      setLoading(true);
      try {
        const payload = await fetchLogs({ ...filter, page: p, pageSize: PAGE_SIZE });
        setLogs(payload.list);
        setTotal(payload.total);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    const filter: LogListFilter = {};
    if (filterCallType) filter.callType = filterCallType;
    if (filterApiType) filter.apiType = filterApiType;
    if (filterUserId.trim()) filter.userId = filterUserId.trim();
    if (filterModelId.trim()) filter.modelCustomId = filterModelId.trim();
    load(page, filter);
  }, [page, filterCallType, filterApiType, filterUserId, filterModelId, load]);

  const handleFilterChange = () => {
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const columns: TableColumn<LogRecord>[] = [
    {
      key: 'createdAt',
      title: '时间',
      render: (item) => new Date(item.createdAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
    },
    {
      key: 'modelCustomId',
      title: 'API ID',
      render: (item) => (
        <span style={{ fontFamily: 'monospace', fontSize: '0.85em' }}>{item.modelCustomId}</span>
      ),
    },
    {
      key: 'apiType',
      title: 'API 类型',
      render: (item) => API_TYPE_LABELS[item.apiType] ?? item.apiType,
    },
    {
      key: 'callType',
      title: '调用场景',
      render: (item) => CALL_TYPE_LABELS[item.callType] ?? item.callType,
    },
    {
      key: 'user',
      title: '用户',
      render: (item) =>
        item.username || item.userEmail
          ? `${item.username ?? ''}${item.userEmail ? ` (${item.userEmail})` : ''}`
          : item.userId ?? '系统',
    },
    {
      key: 'totalTokens',
      title: 'Token 消耗',
      render: (item) =>
        item.totalTokens != null ? (
          <span title={`输入 ${item.promptTokens ?? '-'} / 输出 ${item.completionTokens ?? '-'}`}>
            {item.totalTokens.toLocaleString()}
          </span>
        ) : (
          <span style={{ color: '#999' }}>—</span>
        ),
    },
    {
      key: 'durationMs',
      title: '耗时',
      render: (item) => `${item.durationMs} ms`,
    },
    {
      key: 'isSuccess',
      title: '状态',
      render: (item) =>
        item.isSuccess ? (
          <span style={{ color: '#22c55e', fontWeight: 600 }}>成功</span>
        ) : (
          <span style={{ color: '#ef4444', fontWeight: 600 }} title={item.errorMessage ?? ''}>
            失败
          </span>
        ),
    },
  ];

  return (
    <PageErrorBoundary>
      <div className={styles.grid}>
        <PageCard title="API 调用日志">
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px', alignItems: 'flex-end' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85em', color: '#666' }}>
              调用场景
              <select
                value={filterCallType}
                onChange={(e) => { setFilterCallType(e.target.value as CallType | ''); handleFilterChange(); }}
                style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #e5e7eb', fontSize: '0.9em', minWidth: '120px' }}
              >
                <option value="">全部</option>
                {(Object.entries(CALL_TYPE_LABELS) as [CallType, string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85em', color: '#666' }}>
              API 类型
              <select
                value={filterApiType}
                onChange={(e) => { setFilterApiType(e.target.value as ApiType | ''); handleFilterChange(); }}
                style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #e5e7eb', fontSize: '0.9em', minWidth: '130px' }}
              >
                <option value="">全部</option>
                {(Object.entries(API_TYPE_LABELS) as [ApiType, string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85em', color: '#666' }}>
              用户 ID
              <input
                type="text"
                value={filterUserId}
                placeholder="输入用户 ID"
                onChange={(e) => { setFilterUserId(e.target.value); handleFilterChange(); }}
                style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #e5e7eb', fontSize: '0.9em', width: '160px' }}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85em', color: '#666' }}>
              API 自定义 ID
              <input
                type="text"
                value={filterModelId}
                placeholder="输入 API ID"
                onChange={(e) => { setFilterModelId(e.target.value); handleFilterChange(); }}
                style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #e5e7eb', fontSize: '0.9em', width: '160px' }}
              />
            </label>

            <span style={{ marginLeft: 'auto', fontSize: '0.85em', color: '#999', alignSelf: 'center' }}>
              共 {total.toLocaleString()} 条
            </span>
          </div>

          <DataTable rows={logs} columns={columns} emptyText={loading ? '加载中…' : '暂无日志'} />

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '16px' }}>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                style={{ padding: '4px 12px', borderRadius: '6px', border: '1px solid #e5e7eb', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.4 : 1 }}
              >
                上一页
              </button>
              <span style={{ fontSize: '0.9em', color: '#666' }}>
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                style={{ padding: '4px 12px', borderRadius: '6px', border: '1px solid #e5e7eb', cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? 0.4 : 1 }}
              >
                下一页
              </button>
            </div>
          )}
        </PageCard>
      </div>
    </PageErrorBoundary>
  );
}
