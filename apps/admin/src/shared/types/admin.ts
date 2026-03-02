import type { PagedPayload } from './api';

interface WorkspaceSummary {
  workspaceId: string;
  name: string;
  type: string;
  role: string;
}

export interface AdminUser {
  id: string;
  userId: string;
  email: string;
  username: string;
  avatar?: string | null;
  signature?: string | null;
  createdAt: string;
  updatedAt: string;
  workspaces: WorkspaceSummary[];
}

export type ApiType = 'llm' | 'image' | 'video' | 'vector';

export interface CustomParam {
  key: string;
  value: string;
}

export interface ModelProviderConfig {
  providerId: string;
  customId: string;
  apiType: ApiType;
  baseUrl: string;
  modelName: string;
  apiKeyMasked: string;
  customParams: CustomParam[];
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TalentProfile {
  id: string;
  name: string;
  role: string;
  tags: string[];
  rating: number;
  isAvailable: boolean;
}

// Agent 类型已移至 ./agent.ts
export type { Agent, AgentType } from './agent';

export interface RuntimeMetric {
  key: string;
  label: string;
  value: string;
  trend: 'up' | 'flat' | 'down';
}

export type CallType = 'chat' | 'plan' | 'rag_embed' | 'memory';

export interface LogRecord {
  id: string;
  modelCustomId: string;
  apiType: ApiType;
  callType: CallType;
  userId: string | null;
  userEmail: string | null;
  username: string | null;
  channelId: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  durationMs: number;
  isSuccess: boolean;
  errorMessage: string | null;
  createdAt: string;
}

export interface LogListFilter {
  callType?: CallType;
  apiType?: ApiType;
  userId?: string;
  modelCustomId?: string;
  page?: number;
  pageSize?: number;
}

export interface SystemConfig {
  electronDataPushIntervalSeconds: number;
  websocketHeartbeatSeconds: number;
  isMaintenanceMode: boolean;
}

export interface DashboardStat {
  total: number;
  today: number;
  yesterday: number;
  lastWeek: number;
}

export interface CallTypeBreakdown {
  callType: CallType;
  count: number;
}

export interface TopTokenUser {
  userId: string;
  username: string;
  userEmail: string;
  totalTokens: number;
}

export interface DashboardPayload {
  users: DashboardStat;
  generatedArticles: DashboardStat;
  calls: DashboardStat;
  tokens: DashboardStat;
  successRate: { total: number; today: number };
  callTypeBreakdown: CallTypeBreakdown[];
  topTokenUsers: TopTokenUser[];
}

export type UserListPayload = AdminUser[];

export interface TalentListPayload extends PagedPayload<TalentProfile> {}

export interface LogListPayload extends PagedPayload<LogRecord> {}
