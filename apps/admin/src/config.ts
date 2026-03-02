interface AppEnv {
  apiBaseUrl: string;
  wsUrl: string;
  routeBase: string;
  loginUsername: string;
  loginPassword: string;
}

const ensureEnvValue = (key: keyof ImportMetaEnv): string => {
  const value = import.meta.env[key];

  if (!value || value.trim().length === 0) {
    throw new Error(`[Admin Config] 缺少必要环境变量：${key}`);
  }

  return value;
};

const readEnv = (): AppEnv => ({
  apiBaseUrl: ensureEnvValue('VITE_ADMIN_API_BASE_URL'),
  wsUrl: ensureEnvValue('VITE_ADMIN_WS_URL'),
  routeBase: ensureEnvValue('VITE_ADMIN_ROUTE_BASE'),
  loginUsername: ensureEnvValue('VITE_ADMIN_LOGIN_USERNAME'),
  loginPassword: ensureEnvValue('VITE_ADMIN_LOGIN_PASSWORD'),
});

export const appEnv = readEnv();
