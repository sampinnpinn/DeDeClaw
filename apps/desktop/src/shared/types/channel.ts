export interface ChannelData {
  channelId: string;
  name: string;
  avatar: string | null;
  agentIds: string[];
  isMuted: boolean;
  lastMessage: string | null;
  lastMessageTime: string;
  createdAt?: string;
  lastMessageSenderName?: string;
}

export type ChannelCreationContext = 'hired-talent-chat';

export interface ChannelBaseResponse {
  success: boolean;
  message?: string;
}

export interface ChannelCreateResponse extends ChannelBaseResponse {
  data?: ChannelData;
}

export interface ChannelListResponse extends ChannelBaseResponse {
  data?: ChannelData[];
}

export interface ChannelUpdateResponse extends ChannelBaseResponse {
  data?: ChannelData;
}

export interface ChannelMemberUpdateData {
  agentIds: string[];
}

export interface ChannelMemberUpdateResponse extends ChannelBaseResponse {
  data?: ChannelMemberUpdateData;
}

export interface ChannelDeleteResponse extends ChannelBaseResponse {
  message?: string;
}

export interface ChannelMessageData {
  messageId: string;
  channelId: string;
  senderType: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  content: string;
  ragSources: string[];
  createdAt: string;
}

export interface ChannelMessagesData {
  messages: ChannelMessageData[];
  hasMore: boolean;
}

export interface ChannelMessagesResponse extends ChannelBaseResponse {
  data?: ChannelMessagesData;
}

export interface ChannelUpdatePayload {
  name?: string;
  avatar?: string;
  isMuted?: boolean;
}
