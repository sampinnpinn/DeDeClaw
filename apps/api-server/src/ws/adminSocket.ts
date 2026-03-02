import type { Server as HttpServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { prisma } from '../lib/prisma.js';

interface UserHeartbeatPayload {
  onlineUsers: number;
  activeConversations: number;
  failedRequests: number;
}

interface AdminSocketMessage<TPayload> {
  event: string;
  timestamp: string;
  payload: TPayload;
}

const SYSTEM_CONFIG_KEY = 'default';
const DEFAULT_HEARTBEAT_SECONDS = 30;
const ACTIVE_CONVERSATION_WINDOW_MINUTES = 15;
const FAILED_REQUEST_WINDOW_MINUTES = 60;

type SendHeartbeatFn = (socket: WebSocket) => Promise<void>;

async function resolveHeartbeatDelayMs(): Promise<number> {
  try {
    const config = await prisma.systemConfig.findUnique({
      where: { key: SYSTEM_CONFIG_KEY },
      select: { websocketHeartbeatSeconds: true },
    });

    const seconds = config?.websocketHeartbeatSeconds ?? DEFAULT_HEARTBEAT_SECONDS;
    return Math.max(5, seconds) * 1000;
  } catch {
    return DEFAULT_HEARTBEAT_SECONDS * 1000;
  }
}

async function buildHeartbeatPayload(): Promise<UserHeartbeatPayload> {
  const now = Date.now();
  const activeConversationSince = new Date(
    now - ACTIVE_CONVERSATION_WINDOW_MINUTES * 60 * 1000
  );
  const failedRequestSince = new Date(now - FAILED_REQUEST_WINDOW_MINUTES * 60 * 1000);

  const [onlineUsers, activeConversations, failedRequests] = await Promise.all([
    prisma.user.count(),
    prisma.channel.count({
      where: {
        lastMessageTime: {
          gte: activeConversationSince,
        },
      },
    }),
    prisma.apiCallLog.count({
      where: {
        isSuccess: false,
        createdAt: {
          gte: failedRequestSince,
        },
      },
    }),
  ]);

  return {
    onlineUsers,
    activeConversations,
    failedRequests,
  };
}

function toHeartbeatMessage(
  payload: UserHeartbeatPayload
): AdminSocketMessage<UserHeartbeatPayload> {
  return {
    event: 'user-heartbeat',
    timestamp: new Date().toISOString(),
    payload,
  };
}

export function initAdminWebSocket(server: HttpServer): void {
  const wss = new WebSocketServer({
    server,
    path: '/admin/ws',
  });

  let timer: NodeJS.Timeout | null = null;

  const sendHeartbeat: SendHeartbeatFn = async (socket) => {
    if (socket.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      const payload = await buildHeartbeatPayload();
      const message = toHeartbeatMessage(payload);
      socket.send(JSON.stringify(message));
    } catch (error) {
      console.error('[WS] send heartbeat failed:', error);
    }
  };

  const broadcastHeartbeat = async (): Promise<void> => {
    const clients = Array.from(wss.clients).filter(
      (client): client is WebSocket => client.readyState === WebSocket.OPEN
    );

    if (clients.length === 0) {
      return;
    }

    try {
      const payload = await buildHeartbeatPayload();
      const message = JSON.stringify(toHeartbeatMessage(payload));
      clients.forEach((client: WebSocket) => {
        client.send(message);
      });
    } catch (error) {
      console.error('[WS] broadcast heartbeat failed:', error);
    }
  };

  const scheduleNextTick = async (): Promise<void> => {
    const delay = await resolveHeartbeatDelayMs();
    timer = setTimeout(() => {
      void tick();
    }, delay);
  };

  const tick = async (): Promise<void> => {
    await broadcastHeartbeat();
    await scheduleNextTick();
  };

  wss.on('connection', (socket: WebSocket) => {
    void sendHeartbeat(socket);

    socket.on('error', (error: Error) => {
      console.error('[WS] client error:', error.message);
    });
  });

  server.on('close', () => {
    if (timer) {
      clearTimeout(timer);
    }
    wss.close();
  });

  void scheduleNextTick();
  console.log('[WS] admin socket ready at ws://<host>/admin/ws');
}
