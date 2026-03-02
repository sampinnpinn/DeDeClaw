import { useEffect, useState } from 'react';
import PageCard from '@/components/PageCard';
import PageErrorBoundary from '@/components/PageErrorBoundary';
import { fetchDashboard } from '@/services/adminService';
import { useAdminSocket } from '@/hooks/useAdminSocket';
import type { CallType, CallTypeBreakdown, DashboardPayload, TopTokenUser } from '@/shared/types/admin';
import styles from './PageLayout.module.css';

const CALL_TYPE_LABELS: Record<CallType, string> = {
  chat: '普通聊天',
  plan: '计划模式',
  rag_embed: 'RAG 向量化',
  memory: '记忆提取',
};

// 简洁色板：灰阶 + 一个主色
const PIE_COLORS = ['#111827', '#6b7280', '#9ca3af', '#d1d5db'];

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatPct(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

interface CompareRowProps {
  label: string;
  value: number;
  today: number;
  yesterday: number;
  lastWeek: number;
  formatter?: (n: number) => string;
}

function CompareRow({ label, value, today, yesterday, lastWeek, formatter = formatNum }: CompareRowProps) {
  return (
    <article className={styles.metricCard}>
      <p className={styles.metricLabel}>{label}</p>
      <p className={styles.metricValue}>{formatter(value)}</p>
      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 11, color: '#6b7280' }}>今日 {formatter(today)}</span>
        <span style={{ fontSize: 11, color: '#9ca3af' }}>昨日 {formatter(yesterday)}</span>
        <span style={{ fontSize: 11, color: '#9ca3af' }}>上周 {formatter(lastWeek)}</span>
      </div>
    </article>
  );
}

function PieChart({ data }: { data: CallTypeBreakdown[] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) {
    return <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>暂无数据</p>;
  }

  const size = 140;
  const cx = size / 2;
  const cy = size / 2;
  const r = 52;
  const innerR = 28;

  let cumAngle = -Math.PI / 2;
  const slices = data.map((d, i) => {
    const angle = (d.count / total) * 2 * Math.PI;
    const startAngle = cumAngle;
    cumAngle += angle;
    const endAngle = cumAngle;

    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const ix1 = cx + innerR * Math.cos(endAngle);
    const iy1 = cy + innerR * Math.sin(endAngle);
    const ix2 = cx + innerR * Math.cos(startAngle);
    const iy2 = cy + innerR * Math.sin(startAngle);
    const largeArc = angle > Math.PI ? 1 : 0;

    const d_path = [
      `M ${x1} ${y1}`,
      `A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`,
      `L ${ix1} ${iy1}`,
      `A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix2} ${iy2}`,
      'Z',
    ].join(' ');

    return { path: d_path, color: PIE_COLORS[i % PIE_COLORS.length], item: d };
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <svg width={size} height={size} style={{ flexShrink: 0 }}>
        {slices.map((s, i) => (
          <path key={i} d={s.path} fill={s.color} />
        ))}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize={11} fill="#6b7280">总计</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize={13} fontWeight="700" fill="#111827">
          {formatNum(total)}
        </text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {slices.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: s.color, flexShrink: 0 }} />
            <span style={{ color: '#374151' }}>{CALL_TYPE_LABELS[s.item.callType] ?? s.item.callType}</span>
            <span style={{ color: '#9ca3af', marginLeft: 'auto', paddingLeft: 8 }}>
              {formatNum(s.item.count)} ({((s.item.count / total) * 100).toFixed(0)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TokenRankTable({ users }: { users: TopTokenUser[] }) {
  if (users.length === 0) {
    return <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>暂无数据</p>;
  }
  const max = users[0].totalTokens;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {users.map((u, i) => (
        <div key={u.userId} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 18, fontSize: 11, color: i < 3 ? '#111827' : '#9ca3af', fontWeight: i < 3 ? 700 : 400, textAlign: 'right', flexShrink: 0 }}>
            {i + 1}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ fontSize: 12, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {u.username || u.userEmail || u.userId}
                {u.username && u.userEmail && (
                  <span style={{ color: '#9ca3af', marginLeft: 4 }}>({u.userEmail})</span>
                )}
              </span>
              <span style={{ fontSize: 12, color: '#111827', fontWeight: 600, flexShrink: 0, marginLeft: 8 }}>
                {formatNum(u.totalTokens)}
              </span>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: '#f3f4f6', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(u.totalTokens / max) * 100}%`, background: '#111827', borderRadius: 2 }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

const emptyPayload: DashboardPayload = {
  users: { total: 0, today: 0, yesterday: 0, lastWeek: 0 },
  generatedArticles: { total: 0, today: 0, yesterday: 0, lastWeek: 0 },
  calls: { total: 0, today: 0, yesterday: 0, lastWeek: 0 },
  tokens: { total: 0, today: 0, yesterday: 0, lastWeek: 0 },
  successRate: { total: 1, today: 1 },
  callTypeBreakdown: [],
  topTokenUsers: [],
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardPayload>(emptyPayload);
  const { heartbeat } = useAdminSocket();

  useEffect(() => {
    fetchDashboard().then(setData);
  }, []);

  return (
    <PageErrorBoundary>
      <div className={styles.grid}>
        {/* 指标卡 */}
        <div className={styles.metrics}>
          <CompareRow
            label="总用户数"
            value={data.users.total}
            today={data.users.today}
            yesterday={data.users.yesterday}
            lastWeek={data.users.lastWeek}
          />
          <CompareRow
            label="生成文章数量"
            value={data.generatedArticles.total}
            today={data.generatedArticles.today}
            yesterday={data.generatedArticles.yesterday}
            lastWeek={data.generatedArticles.lastWeek}
          />
          <CompareRow
            label="API 调用次数"
            value={data.calls.total}
            today={data.calls.today}
            yesterday={data.calls.yesterday}
            lastWeek={data.calls.lastWeek}
          />
          <CompareRow
            label="总消耗 Token"
            value={data.tokens.total}
            today={data.tokens.today}
            yesterday={data.tokens.yesterday}
            lastWeek={data.tokens.lastWeek}
          />
          <article className={styles.metricCard}>
            <p className={styles.metricLabel}>成功率</p>
            <p className={styles.metricValue}>{formatPct(data.successRate.total)}</p>
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 11, color: '#6b7280' }}>今日 {formatPct(data.successRate.today)}</span>
            </div>
          </article>
          <article className={styles.metricCard}>
            <p className={styles.metricLabel}>WS 在线用户</p>
            <p className={styles.metricValue}>{heartbeat.onlineUsers}</p>
            <div style={{ marginTop: 8 }}>
              <span style={{ fontSize: 11, color: '#6b7280' }}>活跃会话 {heartbeat.activeConversations}</span>
            </div>
          </article>
        </div>

        {/* 图表行 */}
        <div className={styles.row}>
          <PageCard title="调用场景占比">
            <PieChart data={data.callTypeBreakdown} />
          </PageCard>

          <PageCard title="用户 Token 消耗排名 Top 10">
            <TokenRankTable users={data.topTokenUsers} />
          </PageCard>
        </div>
      </div>
    </PageErrorBoundary>
  );
}
