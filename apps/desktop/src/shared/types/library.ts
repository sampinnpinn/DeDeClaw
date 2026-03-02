export type LibraryFileType = 'pdf' | 'md' | 'doc' | 'docx' | 'excel' | 'image';

export type EmbedStatus = 'pending' | 'processing' | 'done' | 'failed';

export type LibraryScope = 'personal' | 'shared';

export interface LibraryFile {
  fileId: string;
  fileName: string;
  fileType: LibraryFileType | string;
  fileSize: number;
  mimeType: string;
  tags: string[];
  embedStatus: EmbedStatus;
  embedError?: string | null;
  chunkCount: number;
  uploadedBy: string;
  uploaderName: string;
  summary: string | null;
  thumbnailBase64: string | null;
  textSnippet: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LibraryFilePreview {
  fileId: string;
  fileName: string;
  fileType: string;
  mimeType: string;
  isOwner: boolean;
  rawContent: string | null;
  imageBase64: string | null;
  chunks: Array<{ index: number; content: string }>;
}

export interface UploadLibraryFileResponse {
  success: boolean;
  data?: LibraryFile;
  message?: string;
}

export interface FetchLibraryFilesResponse {
  success: boolean;
  data?: LibraryFile[];
  message?: string;
}
