// Agent 人才类型定义（Admin 端完整版本）
export interface Agent {
  id: string;
  agentId: string;
  name: string;
  avatar: string | null;
  role: string;
  description: string | null;
  prompt: string | null;
  skills: string | null;
  type: string;
  priceRate: number;
  priceUnit: string;
  modelId: string | null;
  isListed: boolean;
  createdAt: string;
  updatedAt: string;
}

// Agent 类型枚举
export type AgentType = 'all' | 'assistant' | 'developer' | 'designer' | 'analyst';
