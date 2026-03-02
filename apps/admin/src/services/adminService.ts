import { requestJson } from '@/services/httpClient';
import type {
  Agent,
  AdminUser,
  DashboardPayload,
  LogListFilter,
  LogListPayload,
  ModelProviderConfig,
  SystemConfig,
  TalentListPayload,
} from '@/shared/types/admin';

const emptyDashboard: DashboardPayload = {
  users: { total: 0, today: 0, yesterday: 0, lastWeek: 0 },
  generatedArticles: { total: 0, today: 0, yesterday: 0, lastWeek: 0 },
  calls: { total: 0, today: 0, yesterday: 0, lastWeek: 0 },
  tokens: { total: 0, today: 0, yesterday: 0, lastWeek: 0 },
  successRate: { total: 1, today: 1 },
  callTypeBreakdown: [],
  topTokenUsers: [],
};

export const fetchDashboard = async (): Promise<DashboardPayload> => {
  const result = await requestJson<DashboardPayload>('/admin/dashboard');
  return result.isSuccess && result.data ? result.data : emptyDashboard;
};

export const fetchUsers = async (): Promise<AdminUser[]> => {
  const result = await requestJson<AdminUser[]>('/admin/users');
  return result.isSuccess && result.data ? result.data : [];
};

export const fetchTalent = async (): Promise<TalentListPayload> => {
  const result = await requestJson<TalentListPayload>('/admin/talent-market');
  return result.isSuccess && result.data ? result.data : { list: [], total: 0, page: 1, pageSize: 20 };
};

export const fetchApiConfigs = async (): Promise<ModelProviderConfig[]> => {
  const result = await requestJson<ModelProviderConfig[]>('/admin/model-configs');
  return result.isSuccess && result.data ? result.data : [];
};

export const fetchSystemConfig = async (): Promise<SystemConfig> => {
  const result = await requestJson<SystemConfig>('/admin/system-config');
  return result.isSuccess && result.data
    ? result.data
    : { electronDataPushIntervalSeconds: 20, websocketHeartbeatSeconds: 30, isMaintenanceMode: false };
};

export const fetchLogs = async (filter?: LogListFilter): Promise<LogListPayload> => {
  const params = new URLSearchParams();
  if (filter?.callType) params.set('callType', filter.callType);
  if (filter?.apiType) params.set('apiType', filter.apiType);
  if (filter?.userId) params.set('userId', filter.userId);
  if (filter?.modelCustomId) params.set('modelCustomId', filter.modelCustomId);
  if (filter?.page) params.set('page', String(filter.page));
  if (filter?.pageSize) params.set('pageSize', String(filter.pageSize));
  const query = params.toString();
  const result = await requestJson<LogListPayload>(`/admin/logs${query ? `?${query}` : ''}`);
  return result.isSuccess && result.data ? result.data : { list: [], total: 0, page: 1, pageSize: 20 };
};

export const createApiConfig = async (payload: {
  customId: string;
  apiType: string;
  baseUrl: string;
  modelName: string;
  apiKey: string;
  customParams: { key: string; value: string }[];
  isEnabled: boolean;
}): Promise<boolean> => {
  console.log('[createApiConfig] 发送请求:', payload);
  const result = await requestJson<{ created: boolean }>('/admin/model-configs', {
    method: 'POST',
    body: payload,
  });
  console.log('[createApiConfig] 响应结果:', result);

  return result.isSuccess;
};

export const updateApiConfig = async (
  providerId: string,
  payload: {
    customId: string;
    apiType: string;
    baseUrl: string;
    modelName: string;
    apiKey?: string;
    customParams: { key: string; value: string }[];
    isEnabled: boolean;
  }
): Promise<boolean> => {
  const result = await requestJson<{ updated: boolean }>(`/admin/model-configs/${providerId}`, {
    method: 'PUT',
    body: payload,
  });

  return result.isSuccess;
};

export const deleteApiConfig = async (providerId: string): Promise<boolean> => {
  const result = await requestJson<{ deleted: boolean }>(`/admin/model-configs/${providerId}`, {
    method: 'DELETE',
  });

  return result.isSuccess;
};

export const saveSystemConfig = async (payload: SystemConfig): Promise<boolean> => {
  const result = await requestJson<{ updated: boolean }>('/admin/system-config', {
    method: 'PUT',
    body: payload as unknown as Record<string, unknown>,
  });

  return result.isSuccess;
};

// Agent API
export const fetchAgents = async (): Promise<Agent[]> => {
  const result = await requestJson<Agent[]>('/admin/agents');
  return result.isSuccess && result.data ? result.data : [];
};

export const createAgent = async (payload: {
  name: string;
  avatar?: string;
  role: string;
  description?: string;
  prompt?: string;
  skills?: string;
  priceRate: number;
  priceUnit: string;
  modelId?: string;
  isListed: boolean;
}): Promise<boolean> => {
  const result = await requestJson<Agent>('/admin/agents', {
    method: 'POST',
    body: payload,
  });

  return result.isSuccess;
};

export const updateAgent = async (
  agentId: string,
  payload: {
    name?: string;
    avatar?: string | null;
    role?: string;
    description?: string | null;
    prompt?: string | null;
    priceRate?: number;
    priceUnit?: string;
    modelId?: string | null;
    isListed?: boolean;
  }
): Promise<boolean> => {
  const result = await requestJson<Agent>(`/admin/agents/${agentId}`, {
    method: 'PUT',
    body: payload,
  });

  return result.isSuccess;
};

export const updateAgentSkills = async (agentId: string, skills: string): Promise<boolean> => {
  const result = await requestJson<Agent>(`/admin/agents/${agentId}`, {
    method: 'PUT',
    body: { skills },
  });
  return result.isSuccess;
};

export const deleteAgent = async (agentId: string): Promise<boolean> => {
  const result = await requestJson<{ deleted: boolean }>(`/admin/agents/${agentId}`, {
    method: 'DELETE',
  });

  return result.isSuccess;
};

export const deleteUser = async (userId: string): Promise<boolean> => {
  const result = await requestJson<{ success: boolean }>(`/admin/users/${userId}`, {
    method: 'DELETE',
  });

  return result.isSuccess;
};
