import type { Agent } from '@/shared/types/agent';
import { API_BASE_URL } from './apiBase';

// API 响应类型
interface ApiResponse<T> {
  isSuccess: boolean;
  data?: T;
  error?: string;
}

// 获取已上架的 Agent 列表
export const fetchListedAgents = async (): Promise<Agent[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/admin/agents/listed`);
    const result: ApiResponse<Agent[]> = await response.json();

    if (result.isSuccess && result.data) {
      return result.data;
    }

    console.error('Failed to fetch agents:', result.error);
    return [];
  } catch (error) {
    console.error('Network error when fetching agents:', error);
    return [];
  }
};
