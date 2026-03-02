import { authService } from './authService';
import { API_BASE_URL } from './apiBase';
import type {
  ChannelBaseResponse,
  ChannelCreationContext,
  ChannelCreateResponse,
  ChannelDeleteResponse,
  ChannelListResponse,
  ChannelMemberUpdateResponse,
  ChannelMessagesResponse,
  ChannelUpdatePayload,
  ChannelUpdateResponse,
} from '../shared/types/channel';

export const channelService = {
  async createChannel(
    agentIds: string[],
    name: string,
    avatar?: string,
    creationContext?: ChannelCreationContext,
  ): Promise<ChannelCreateResponse> {
    const token = authService.getToken();
    const response = await fetch(`${API_BASE_URL}/channels/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ agentIds, name, avatar, creationContext }),
    });
    return await response.json() as ChannelCreateResponse;
  },

  async getChannels(): Promise<ChannelListResponse> {
    const token = authService.getToken();
    const response = await fetch(`${API_BASE_URL}/channels/list`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return await response.json() as ChannelListResponse;
  },

  async addMembers(channelId: string, agentIds: string[]): Promise<ChannelMemberUpdateResponse> {
    const token = authService.getToken();
    const response = await fetch(`${API_BASE_URL}/channels/${channelId}/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ agentIds }),
    });
    return await response.json() as ChannelMemberUpdateResponse;
  },

  async removeMember(channelId: string, agentId: string): Promise<ChannelMemberUpdateResponse> {
    const token = authService.getToken();
    const response = await fetch(`${API_BASE_URL}/channels/${channelId}/members/${agentId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return await response.json() as ChannelMemberUpdateResponse;
  },

  async updateChannel(channelId: string, data: ChannelUpdatePayload): Promise<ChannelUpdateResponse> {
    const token = authService.getToken();
    const response = await fetch(`${API_BASE_URL}/channels/${channelId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    return await response.json() as ChannelUpdateResponse;
  },

  async deleteChannel(channelId: string): Promise<ChannelDeleteResponse> {
    const token = authService.getToken();
    const response = await fetch(`${API_BASE_URL}/channels/${channelId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return await response.json() as ChannelDeleteResponse;
  },

  async clearMessages(channelId: string): Promise<ChannelBaseResponse> {
    const token = authService.getToken();
    const response = await fetch(`${API_BASE_URL}/channels/${channelId}/messages`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return await response.json() as ChannelBaseResponse;
  },

  async getMessages(
    channelId: string,
    params?: {
      limit?: number;
      beforeCreatedAt?: string;
    },
  ): Promise<ChannelMessagesResponse> {
    const token = authService.getToken();
    const searchParams = new URLSearchParams();
    if (params?.limit !== undefined) {
      searchParams.set('limit', String(params.limit));
    }
    if (params?.beforeCreatedAt) {
      searchParams.set('beforeCreatedAt', params.beforeCreatedAt);
    }
    const query = searchParams.toString();
    const response = await fetch(`${API_BASE_URL}/channels/${channelId}/messages${query ? `?${query}` : ''}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return await response.json() as ChannelMessagesResponse;
  },

  async saveConfirmMessage(channelId: string, params: {
    agentId: string;
    agentName: string;
    agentAvatar?: string;
    content: string;
  }): Promise<{ messageId: string }> {
    const token = authService.getToken();
    const response = await fetch(`${API_BASE_URL}/channels/${channelId}/confirm-plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(params),
    });
    const result = await response.json() as { success: boolean; data?: { messageId: string }; message?: string };
    if (!result.success || !result.data) throw new Error(result.message ?? '保存确认消息失败');
    return result.data;
  },

  async sendChatStream(
    channelId: string,
    content: string,
    mentionedAgentIds: string[],
    isPlanMode: boolean,
    callbacks: {
      onUserMessage: (msg: Record<string, unknown>) => void;
      onAgentStart: (info: { tempMessageId: string; agentId: string; agentName: string; avatar: string | null; isPlan?: boolean; planCount?: number; isOnlineSearch?: boolean }) => void;
      onToken: (tempMessageId: string, token: string) => void;
      onAgentEnd: (tempMessageId: string, message: Record<string, unknown> | null) => void;
      onRagSources?: (tempMessageId: string, fileNames: string[]) => void;
      onDone: () => void;
      onError: (err: string) => void;
    },
    libraryTag?: string,
    enableWebSearch?: boolean,
  ): Promise<void> {
    const token = authService.getToken();
    const response = await fetch(`${API_BASE_URL}/channels/${channelId}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ content, mentionedAgentIds, isPlanMode, libraryTag, enableWebSearch }),
    });

    if (!response.ok || !response.body) {
      callbacks.onError('请求失败');
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let isDone = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() ?? '';

      for (const part of parts) {
        const lines = part.trim().split('\n');
        let eventName = '';
        let dataStr = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) eventName = line.slice(7).trim();
          if (line.startsWith('data: ')) dataStr = line.slice(6).trim();
        }
        if (!eventName || !dataStr) continue;

        try {
          const data = JSON.parse(dataStr) as Record<string, unknown>;
          if (eventName === 'user_message') {
            callbacks.onUserMessage(data);
          } else if (eventName === 'agent_start') {
            callbacks.onAgentStart({
              tempMessageId: data.tempMessageId as string,
              agentId: data.agentId as string,
              agentName: data.agentName as string,
              avatar: data.avatar as string | null,
              isPlan: data.isPlan as boolean | undefined,
              planCount: data.planCount as number | undefined,
              isOnlineSearch: data.isOnlineSearch as boolean | undefined,
            });
          } else if (eventName === 'token') {
            callbacks.onToken(data.tempMessageId as string, data.token as string);
          } else if (eventName === 'agent_end') {
            callbacks.onAgentEnd(
              data.tempMessageId as string,
              data.cancelled ? null : (data.message as Record<string, unknown>),
            );
          } else if (eventName === 'rag_sources') {
            callbacks.onRagSources?.(data.tempMessageId as string, data.fileNames as string[]);
          } else if (eventName === 'done') {
            isDone = true;
            callbacks.onDone();
          } else if (eventName === 'error') {
            isDone = true;
            callbacks.onError(data.message as string);
          }
        } catch {
          // 忽略解析错误
        }
      }
    }
    // 流读完但服务端未发 done/error 事件（异常断开）时，兜底解锁发送状态
    if (!isDone) callbacks.onDone();
  },
};
