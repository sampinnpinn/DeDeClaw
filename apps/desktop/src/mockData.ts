export interface Conversation {
  id: string;
  name: string;
  avatar: string;
  type: 'group' | 'agent';
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount: number;
  isMuted?: boolean;
  memberCount?: number;
  members?: string[];
  description?: string;
  isPinned?: boolean;
  lastMessageSenderName?: string; // 有值且非空时表示 agent 发的，显示为 "名字: 内容"
  isSingleTalentChannel?: boolean;
}

export interface PlanItem {
  title: string;
  summary: string;
  prompt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  userId?: string;
  agentId?: string;
  userName?: string;
  agentName?: string;
  avatar?: string;
  content: string;
  type: 'text' | 'image' | 'file' | 'system' | 'dede_plan';
  metadata?: {
    fileName?: string;
    fileSize?: number;
    imageUrl?: string;
    width?: number;
    height?: number;
    reactions?: Array<{ emoji: string; count: number }>;
    viewCount?: number;
    plans?: PlanItem[];
    planCount?: number;
    contentTypes?: string[];
    confirmed?: boolean;
    viewTaskProgress?: boolean;
    ragSources?: string[];
    loadingText?: string;
    isOnlineSearch?: boolean;
  };
  isLoading?: boolean;
  isSelf?: boolean;
  createdAt: Date;
}

export const mockConversations: Conversation[] = [];

export const mockMessages: Message[] = [];

export const currentUser = {
  id: 'user1',
  name: '张三',
  avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=user1',
};
