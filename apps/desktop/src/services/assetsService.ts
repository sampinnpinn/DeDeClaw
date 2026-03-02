import { authService } from './authService';
import type { Asset, CoverGenerationData, CoverGenerationResponse, FetchAssetResponse, FetchAssetsResponse } from '../shared/types/asset';
import { API_BASE_URL } from './apiBase';

export const assetsService = {
  async createItem(params: { title?: string; assetType?: string }): Promise<Asset> {
    const token = authService.getToken();
    const response = await fetch(`${API_BASE_URL}/assets/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(params),
    });
    const result = await response.json() as FetchAssetResponse;
    if (!result.success || !result.data) throw new Error(result.message ?? '创建失败');
    return result.data;
  },

  async generateCover(assetId: string, params: { referenceImage?: string }): Promise<void> {
    const token = authService.getToken();
    const response = await fetch(`${API_BASE_URL}/assets/items/${assetId}/generate-cover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(params),
    });
    const result = await response.json() as { success: boolean; message?: string };
    if (!result.success) throw new Error(result.message ?? '触发封面生成失败');
  },

  async getCoverGenerationStatus(assetId: string): Promise<CoverGenerationData> {
    const token = authService.getToken();
    const response = await fetch(`${API_BASE_URL}/assets/items/${assetId}/cover-generation-status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await response.json() as CoverGenerationResponse;
    if (!result.success || !result.data) throw new Error(result.message ?? '获取封面生成状态失败');
    return result.data;
  },

  async getItem(assetId: string): Promise<Asset> {
    const token = authService.getToken();
    const response = await fetch(`${API_BASE_URL}/assets/items/${assetId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await response.json() as FetchAssetResponse;
    if (!result.success || !result.data) throw new Error(result.message ?? '获取失败');
    return result.data;
  },

  async getItems(): Promise<Asset[]> {
    const token = authService.getToken();
    const response = await fetch(`${API_BASE_URL}/assets/items`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const result: FetchAssetsResponse = await response.json();
    return result.success && result.data ? result.data : [];
  },

  async deleteItems(ids: string[]): Promise<void> {
    const token = authService.getToken();
    const response = await fetch(`${API_BASE_URL}/assets/items`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ids }),
    });
    const result = await response.json() as { success: boolean; message?: string };
    if (!result.success) throw new Error(result.message ?? '删除失败');
  },

  async updateAssetTags(assetId: string, tags: string[]): Promise<void> {
    const token = authService.getToken();
    const response = await fetch(`${API_BASE_URL}/assets/items/${assetId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ tags }),
    });
    const result = await response.json() as { success: boolean; message?: string };
    if (!result.success) throw new Error(result.message ?? '更新失败');
  },

  async getTags(): Promise<string[]> {
    const token = authService.getToken();
    const response = await fetch(`${API_BASE_URL}/assets/tags`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await response.json() as { success: boolean; data?: string[] };
    return result.success && result.data ? result.data : [];
  },

  async createTag(tag: string): Promise<void> {
    const token = authService.getToken();
    const response = await fetch(`${API_BASE_URL}/assets/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ tag }),
    });
    const result = await response.json() as { success: boolean; message?: string };
    if (!result.success) throw new Error(result.message ?? '创建标签失败');
  },

  async deleteTag(tag: string): Promise<void> {
    const token = authService.getToken();
    const response = await fetch(`${API_BASE_URL}/assets/tags/${encodeURIComponent(tag)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await response.json() as { success: boolean; message?: string };
    if (!result.success) throw new Error(result.message ?? '删除标签失败');
  },

  async generateArticle(params: {
    assetId: string;
    agentId: string;
    title: string;
    summary: string;
    libraryTag?: string;
  }): Promise<void> {
    const token = authService.getToken();
    const response = await fetch(`${API_BASE_URL}/assets/generate-article`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(params),
    });
    const result = await response.json() as { success: boolean; message?: string };
    if (!result.success) throw new Error(result.message ?? '触发生成失败');
  },

  async shareAsset(assetId: string): Promise<{ shareToken: string; shareExpiresAt: string }> {
    const token = authService.getToken();
    const response = await fetch(`${API_BASE_URL}/assets/items/${assetId}/share`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await response.json() as { success: boolean; data?: { shareToken: string; shareExpiresAt: string }; message?: string };
    if (!result.success || !result.data) throw new Error(result.message ?? '创建分享失败');
    return result.data;
  },

  async unshareAsset(assetId: string): Promise<void> {
    const token = authService.getToken();
    const response = await fetch(`${API_BASE_URL}/assets/items/${assetId}/share`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await response.json() as { success: boolean; message?: string };
    if (!result.success) throw new Error(result.message ?? '取消分享失败');
  },

  async updateAsset(assetId: string, data: { title?: string; content?: string; summary?: string; tags?: string[]; coverImage?: string | null; coverReferenceImage?: string | null }): Promise<void> {
    const token = authService.getToken();
    const response = await fetch(`${API_BASE_URL}/assets/items/${assetId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    });
    const result = await response.json() as { success: boolean; message?: string };
    if (!result.success) throw new Error(result.message ?? '更新失败');
  },
};
