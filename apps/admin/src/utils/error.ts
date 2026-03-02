import type { RequestError } from '@/shared/types/api';

export const normalizeError = (error: unknown): RequestError => {
  if (error instanceof Error) {
    return {
      message: error.message,
    };
  }

  return {
    message: '请求失败，请稍后重试',
  };
};
