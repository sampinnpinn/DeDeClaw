import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const envDir = path.resolve(__dirname, '../../');
  const env = loadEnv(mode, envDir, '');

  const ensurePort = (value: string | undefined): number => {
    if (!value || value.trim().length === 0) {
      throw new Error('[Desktop Vite] 缺少必要环境变量：VITE_DESKTOP_PORT');
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error('[Desktop Vite] VITE_DESKTOP_PORT 必须为大于 0 的数字');
    }

    return parsed;
  };

  const configuredPort = ensurePort(env.VITE_DESKTOP_PORT);

  return {
    plugins: [react()],
    base: './',
    build: {
      outDir: 'dist/renderer',
      emptyOutDir: true,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      host: true,
      port: configuredPort,
      strictPort: true,
    },
    envDir,
  };
});
