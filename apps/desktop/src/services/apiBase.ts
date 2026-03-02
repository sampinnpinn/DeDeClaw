const ensureApiBaseUrl = (): string => {
  const value = import.meta.env.VITE_API_BASE_URL;
  if (!value || value.trim().length === 0) {
    throw new Error('[Desktop Config] 缺少必要环境变量：VITE_API_BASE_URL');
  }

  return value;
};

export const API_BASE_URL = ensureApiBaseUrl();
