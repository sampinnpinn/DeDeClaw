import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { modelConfigRouter } from './routes/modelConfig.js';
import { systemConfigRouter } from './routes/systemConfig.js';
import agentRouter from './routes/agent.js';
import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';
import agentHireRouter from './routes/agentHire.js';
import channelRouter from './routes/channel.js';
import libraryRouter from './routes/library.js';
import assetsRouter from './routes/assets.js';
import shareRouter from './routes/share.js';
import logsRouter from './routes/logs.js';
import dashboardRouter from './routes/dashboard.js';
import { errorHandler } from './middleware/errorHandler.js';
import { initAdminWebSocket } from './ws/adminSocket.js';
import { initializeDefaultAdmin } from './lib/init.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const resolveEnvPath = (): string => {
  const candidatePaths = [
    resolve(__dirname, '../../../.env.local'),
    resolve(__dirname, '../../../.env'),
  ];

  const matchedPath = candidatePaths.find((candidatePath) => existsSync(candidatePath));
  if (!matchedPath) {
    throw new Error('[API Server] 未找到 .env.local 或 .env 文件');
  }

  return matchedPath;
};

dotenv.config({ path: resolveEnvPath() });

const requirePortFromEnv = (key: string): number => {
  const rawValue = process.env[key];

  if (!rawValue || rawValue.trim().length === 0) {
    throw new Error(`[API Server] 缺少必要环境变量：${key}`);
  }

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`[API Server] 环境变量 ${key} 必须为大于 0 的数字`);
  }

  return parsed;
};

const optionalPortFromEnv = (key: string): number | null => {
  const rawValue = process.env[key];
  if (!rawValue || rawValue.trim().length === 0) {
    return null;
  }

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`[API Server] 环境变量 ${key} 必须为大于 0 的数字`);
  }

  return parsed;
};

const buildLocalOrigins = (port: number): string[] => [
  `http://localhost:${port}`,
  `http://127.0.0.1:${port}`,
];

const isPrivateNetworkHost = (hostname: string): boolean => {
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return true;
  }

  if (/^10\./.test(hostname) || /^192\.168\./.test(hostname)) {
    return true;
  }

  const matched = hostname.match(/^172\.(\d{1,3})\./);
  if (!matched) {
    return false;
  }

  const secondOctet = Number(matched[1]);
  return Number.isFinite(secondOctet) && secondOctet >= 16 && secondOctet <= 31;
};

const isAllowedLocalNetworkOrigin = (origin: string, adminPort: number, desktopPort: number | null): boolean => {
  try {
    const parsedOrigin = new URL(origin);
    const parsedPort = Number(parsedOrigin.port);
    const isKnownPort = parsedPort === adminPort || (desktopPort !== null && parsedPort === desktopPort);

    if (!isKnownPort) {
      return false;
    }

    return isPrivateNetworkHost(parsedOrigin.hostname);
  } catch {
    return false;
  }
};

const app = express();
const PORT = requirePortFromEnv('PORT');
const adminPort = requirePortFromEnv('VITE_ADMIN_PORT');
const desktopPort = optionalPortFromEnv('VITE_DESKTOP_PORT');
const server = createServer(app);

const defaultCorsOrigins = new Set<string>([
  ...buildLocalOrigins(adminPort),
  ...(desktopPort ? buildLocalOrigins(desktopPort) : []),
  'null',
]);

const envCorsOrigins = (process.env.CORS_ORIGIN ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);

envCorsOrigins.forEach((origin) => defaultCorsOrigins.add(origin));

app.use(cors({
  origin: (origin, callback) => {
    if (
      !origin
      || defaultCorsOrigins.has(origin)
      || isAllowedLocalNetworkOrigin(origin, adminPort, desktopPort)
    ) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS origin not allowed: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/auth', authRouter);
app.use('/admin/users', usersRouter);
app.use('/admin/model-configs', modelConfigRouter);
app.use('/admin/system-config', systemConfigRouter);
app.use('/admin/agents', agentRouter);
app.use('/agent-hire', agentHireRouter);
app.use('/channels', channelRouter);
app.use('/library', libraryRouter);
app.use('/assets', assetsRouter);
app.use('/share', shareRouter);
app.use('/admin/logs', logsRouter);
app.use('/admin/dashboard', dashboardRouter);

app.use(errorHandler);

initAdminWebSocket(server);

server.listen(PORT, async () => {
  console.log(`🚀 API Server running on http://localhost:${PORT}`);
  
  // 初始化默认管理员账户
  await initializeDefaultAdmin();
});
