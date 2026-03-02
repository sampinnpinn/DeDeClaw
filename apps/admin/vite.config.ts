import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  const rootEnvDir = path.resolve(__dirname, '../../');
  const env = loadEnv(mode, rootEnvDir, '');

  const ensurePort = (value: string | undefined): number => {
    if (!value || value.trim().length === 0) {
      throw new Error('[Admin Vite] 缺少必要环境变量：VITE_ADMIN_PORT');
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error('[Admin Vite] VITE_ADMIN_PORT 必须为大于 0 的数字');
    }

    return parsed;
  };

  const configuredPort = ensurePort(env.VITE_ADMIN_PORT);

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: configuredPort,
    },
    base: '/admin',
    envDir: rootEnvDir,
  };
});
