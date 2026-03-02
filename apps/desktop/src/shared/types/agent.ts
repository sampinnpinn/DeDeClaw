// Agent 人才类型定义
export interface Agent {
  agentId: string;
  name: string;
  avatar: string | null;
  role: string;
  description: string | null;
  type: string;
  priceRate: number;
  priceUnit: string;
  modelId: string | null;
}

// Admin 端的 Agent 类型（包含完整字段）
export interface AgentFull extends Agent {
  id: string;
  isListed: boolean;
  createdAt: string;
  updatedAt: string;
}

// Agent 类型枚举
export type AgentType = 'all' | 'assistant' | 'developer' | 'designer' | 'analyst';
