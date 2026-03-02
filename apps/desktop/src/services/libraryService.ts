import { authService } from './authService';
import type { LibraryFile, LibraryFilePreview, LibraryScope, FetchLibraryFilesResponse, UploadLibraryFileResponse } from '../shared/types/library';
import { API_BASE_URL } from './apiBase';

export const libraryService = {
  async getFiles(scope: LibraryScope = 'personal'): Promise<LibraryFile[]> {
    const token = authService.getToken();
    const response = await fetch(`${API_BASE_URL}/library/files?scope=${scope}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const result: FetchLibraryFilesResponse = await response.json();
    return result.success && result.data ? result.data : [];
  },

  async uploadFile(file: File, tags: string[] = []): Promise<LibraryFile> {
    const token = authService.getToken();
    const formData = new FormData();
    formData.append('file', file);
    if (tags.length > 0) {
      formData.append('tags', JSON.stringify(tags));
    }

    const response = await fetch(`${API_BASE_URL}/library/files`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    const result: UploadLibraryFileResponse = await response.json();
    if (!result.success || !result.data) {
      throw new Error(result.message ?? '上传失败');
    }
    return result.data;
  },

  async deleteFile(fileId: string): Promise<void> {
    const token = authService.getToken();
    const response = await fetch(`${API_BASE_URL}/library/files/${fileId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await response.json() as { success: boolean; message?: string };
    if (!result.success) {
      throw new Error(result.message ?? '删除失败');
    }
  },

  async getFilePreview(fileId: string): Promise<LibraryFilePreview> {
    const token = authService.getToken();
    const response = await fetch(`${API_BASE_URL}/library/files/${fileId}/preview`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await response.json() as { success: boolean; data?: LibraryFilePreview; message?: string };
    if (!result.success || !result.data) throw new Error(result.message ?? '获取预览失败');
    return result.data;
  },

  async getTags(): Promise<string[]> {
    const token = authService.getToken();
    const response = await fetch(`${API_BASE_URL}/library/tags`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await response.json() as { success: boolean; data?: string[] };
    return result.success && result.data ? result.data : [];
  },

  async createTag(tag: string): Promise<void> {
    const token = authService.getToken();
    const response = await fetch(`${API_BASE_URL}/library/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ tag }),
    });
    const result = await response.json() as { success: boolean; message?: string };
    if (!result.success) throw new Error(result.message ?? '创建标签失败');
  },

  async deleteTag(tag: string): Promise<void> {
    const token = authService.getToken();
    const response = await fetch(`${API_BASE_URL}/library/tags/${encodeURIComponent(tag)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await response.json() as { success: boolean; message?: string };
    if (!result.success) throw new Error(result.message ?? '删除标签失败');
  },

  async updateFileTags(fileId: string, tags: string[]): Promise<void> {
    const token = authService.getToken();
    const response = await fetch(`${API_BASE_URL}/library/files/${fileId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ tags }),
    });
    const result = await response.json() as { success: boolean; message?: string };
    if (!result.success) {
      throw new Error(result.message ?? '更新失败');
    }
  },

  async retryEmbedding(fileId: string): Promise<void> {
    const token = authService.getToken();
    const response = await fetch(`${API_BASE_URL}/library/files/${fileId}/retry`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await response.json() as { success: boolean; message?: string };
    if (!result.success) {
      throw new Error(result.message ?? '重试失败');
    }
  },
};
