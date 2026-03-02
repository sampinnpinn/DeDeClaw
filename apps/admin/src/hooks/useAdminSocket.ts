import { useEffect, useState } from 'react';
import { appEnv } from '@/config';
import type { AdminSocketEvent, UserHeartbeatPayload } from '@/shared/types/ws';

const defaultHeartbeat: UserHeartbeatPayload = {
  onlineUsers: 0,
  activeConversations: 0,
  failedRequests: 0,
};

export const useAdminSocket = () => {
  const [heartbeat, setHeartbeat] = useState<UserHeartbeatPayload>(defaultHeartbeat);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const socket = new WebSocket(appEnv.wsUrl);

    socket.onopen = () => {
      setIsConnected(true);
    };

    socket.onclose = () => {
      setIsConnected(false);
    };

    socket.onerror = () => {
      setIsConnected(false);
    };

    socket.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as AdminSocketEvent;
        if (parsed.event === 'user-heartbeat') {
          setHeartbeat(parsed.payload as UserHeartbeatPayload);
        }
      } catch {
        // 忽略无法解析的消息
      }
    };

    return () => {
      socket.close();
    };
  }, []);

  return {
    heartbeat,
    isConnected,
  };
};
