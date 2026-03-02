import { useEffect, useState } from 'react';
import { X, FileText, Layers } from 'lucide-react';
import { libraryService } from '../services/libraryService';
import type { LibraryFilePreview } from '../shared/types/library';

interface LibraryFilePreviewModalProps {
  fileId: string | null;
  isOwner: boolean;
  onClose: () => void;
}

type PreviewTab = 'raw' | 'chunks';

export default function LibraryFilePreviewModal({
  fileId,
  isOwner,
  onClose,
}: LibraryFilePreviewModalProps) {
  const [preview, setPreview] = useState<LibraryFilePreview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PreviewTab>('raw');

  useEffect(() => {
    if (!fileId) { setPreview(null); return; }
    setIsLoading(true);
    setError(null);
    setActiveTab(isOwner ? 'raw' : 'chunks');
    libraryService.getFilePreview(fileId)
      .then(setPreview)
      .catch((err) => setError(err instanceof Error ? err.message : '加载失败'))
      .finally(() => setIsLoading(false));
  }, [fileId, isOwner]);

  if (!fileId) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative z-10 w-[680px] max-h-[80vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-gray-900 truncate">
              {preview?.fileName ?? '加载中...'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="ml-3 flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tabs — 仅 owner 且有原文内容时显示切换 */}
        {isOwner && preview && (preview.rawContent !== null || preview.imageBase64 !== null) && (
          <div className="flex items-center gap-1 px-5 pt-3 pb-0 border-b border-gray-100">
            <button
              onClick={() => setActiveTab('raw')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-t-lg border-b-2 transition-colors ${
                activeTab === 'raw'
                  ? 'border-[#2C2D33] text-gray-900'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              <FileText size={12} />
              原文内容
            </button>
            <button
              onClick={() => setActiveTab('chunks')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-t-lg border-b-2 transition-colors ${
                activeTab === 'chunks'
                  ? 'border-[#2C2D33] text-gray-900'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              <Layers size={12} />
              向量化内容
              {preview.chunks.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[10px]">
                  {preview.chunks.length}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {isLoading && (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
              加载中...
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-40 text-red-400 text-sm">
              {error}
            </div>
          )}

          {!isLoading && !error && preview && (
            <>
              {/* 图片预览 */}
              {activeTab === 'raw' && preview.imageBase64 && (
                <img
                  src={preview.imageBase64}
                  alt={preview.fileName}
                  className="max-w-full rounded-lg mx-auto"
                />
              )}

              {/* 原文文本 */}
              {activeTab === 'raw' && preview.rawContent !== null && (
                <pre className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed font-sans">
                  {preview.rawContent}
                </pre>
              )}

              {/* 非 owner 且无原文时提示 */}
              {activeTab === 'raw' && preview.rawContent === null && preview.imageBase64 === null && (
                <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
                  原文件不可查看
                </div>
              )}

              {/* 向量化 chunks */}
              {activeTab === 'chunks' && (
                preview.chunks.length === 0 ? (
                  <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
                    暂无向量化内容
                  </div>
                ) : (
                  <div className="space-y-3">
                    {preview.chunks.map((chunk) => (
                      <div
                        key={chunk.index}
                        className="rounded-xl bg-[#F5F7FA] px-4 py-3"
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-[10px] font-medium text-gray-400 bg-white px-1.5 py-0.5 rounded-md border border-gray-100">
                            #{chunk.index + 1}
                          </span>
                        </div>
                        <p className="text-xs text-gray-700 leading-relaxed">
                          {chunk.content}
                        </p>
                      </div>
                    ))}
                  </div>
                )
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
