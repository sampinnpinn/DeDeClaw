export interface AdminSocketMessage<TPayload> {
  event: string;
  timestamp: string;
  payload: TPayload;
}

export interface UserHeartbeatPayload {
  onlineUsers: number;
  activeConversations: number;
  failedRequests: number;
}

export type AdminSocketEvent =
  | AdminSocketMessage<UserHeartbeatPayload>
  | AdminSocketMessage<Record<string, unknown>>;
