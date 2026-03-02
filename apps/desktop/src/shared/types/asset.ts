export type AssetType = '文章' | '笔记' | '视频' | '图片';
export type GenerationStatus = 'idle' | 'queued' | 'generating' | 'done' | 'error';
export type CoverGenerationStatus = 'idle' | 'pending' | 'running' | 'succeeded' | 'failed';

export interface Asset {
  assetId: string;
  workspaceId: string;
  createdById: string;
  title: string;
  assetType: AssetType | string;
  content: string;
  coverImage: string | null;
  summary?: string | null;
  tags: string[];
  generationStatus: GenerationStatus;
  generationProgress: number;
  coverReferenceImage?: string | null;
  coverGenerationStatus?: CoverGenerationStatus;
  coverGenerationProgress?: number;
  coverGenerationTaskId?: string | null;
  coverGenerationError?: string | null;
  coverGenerationStyle?: string | null;
  coverStylePool?: string[];
  coverGenerationStartedAt?: string | null;
  coverGenerationFinishedAt?: string | null;
  shareToken?: string | null;
  shareExpiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CoverGenerationData {
  coverGenerationStatus: CoverGenerationStatus;
  coverGenerationProgress: number;
  coverGenerationTaskId?: string | null;
  coverGenerationError?: string | null;
  coverGenerationStyle?: string | null;
  hasReferenceImage: boolean;
  coverImage?: string | null;
}

export interface FetchAssetResponse {
  success: boolean;
  data?: Asset;
  message?: string;
}

export interface FetchAssetsResponse {
  success: boolean;
  data?: Asset[];
  message?: string;
}

export interface CoverGenerationResponse {
  success: boolean;
  data?: CoverGenerationData;
  message?: string;
}
