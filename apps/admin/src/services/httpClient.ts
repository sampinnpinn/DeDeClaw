import { appEnv } from '@/config';
import type { ApiResponse, RequestResult } from '@/shared/types/api';
import { normalizeError } from '@/utils/error';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: Record<string, unknown>;
}

export const requestJson = async <TData>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<RequestResult<TData>> => {
  try {
    const token = localStorage.getItem('admin_token') || '';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${appEnv.apiBaseUrl}${endpoint}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      credentials: 'include',
    });

    if (!response.ok) {
      return {
        isSuccess: false,
        data: null,
        error: {
          message: `请求失败：${response.status}`,
          statusCode: response.status,
        },
      };
    }

    const payload = (await response.json()) as ApiResponse<TData>;

    return {
      isSuccess: true,
      data: payload.data,
      error: null,
    };
  } catch (error) {
    return {
      isSuccess: false,
      data: null,
      error: normalizeError(error),
    };
  }
};
