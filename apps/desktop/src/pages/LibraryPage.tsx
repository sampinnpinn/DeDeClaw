import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { Loader2, RefreshCw, Search, SquareMousePointer, Upload, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Modal from '../components/Modal';
import LibraryFilePreviewModal from '../components/LibraryFilePreviewModal';
import { libraryService } from '../services/libraryService';
import type { EmbedStatus, LibraryFile, LibraryScope } from '../shared/types/library';

const FIXED_TAG = '全部';
const LIBRARY_FILES_UPDATED_EVENT = 'library:files-updated';

const EMBED_DOT: Record<EmbedStatus, string | null> = {
  done: null,
  pending: 'bg-yellow-400',
  processing: 'bg-yellow-400',
  failed: 'bg-red-500',
};

function getFileTypeLabel(fileType: string): string {
  const map: Record<string, string> = {
    pdf: 'PDF', md: 'MD', doc: 'DOC', docx: 'DOC',
    excel: 'Excel', xls: 'Excel', xlsx: 'Excel', image: '图片',
  };
  return map[fileType] ?? fileType.toUpperCase();
}

function LibraryPage() {
  const { t } = useTranslation();
  const [selectedFolder, setSelectedFolder] = useState(FIXED_TAG);
  const [文件夹筛选项, set文件夹筛选项] = useState<string[]>([FIXED_TAG]);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [selectedMoveTag, setSelectedMoveTag] = useState<string>('全部');

  const [searchQuery, setSearchQuery] = useState('');
  const scope: LibraryScope = 'personal';
  const [previewFile, setPreviewFile] = useState<{ fileId: string; isOwner: boolean } | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadTags = useCallback(async () => {
    try {
      const tags = await libraryService.getTags();
      set文件夹筛选项([FIXED_TAG, ...tags]);
    } catch (err) {
      console.error('[Library] loadTags error:', err);
    }
  }, []);

  const filesSWRKey = useMemo(() => `library/files:${scope}`, [scope]);
  const fetchFiles = useCallback(() => libraryService.getFiles(scope), [scope]);
  const {
    data: files = [],
    isLoading,
    mutate: mutateFiles,
  } = useSWR<LibraryFile[]>(filesSWRKey, fetchFiles, {
    revalidateOnFocus: false,
    keepPreviousData: true,
    refreshInterval: (currentData) => {
      const currentFiles = currentData ?? [];
      const hasPending = currentFiles.some(
        (f) => f.embedStatus === 'pending' || f.embedStatus === 'processing',
      );
      return hasPending ? 5000 : 0;
    },
  });

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  useEffect(() => {
    const handleLibraryFilesUpdated = () => {
      void mutateFiles();
    };

    window.addEventListener(LIBRARY_FILES_UPDATED_EVENT, handleLibraryFilesUpdated);
    return () => {
      window.removeEventListener(LIBRARY_FILES_UPDATED_EVENT, handleLibraryFilesUpdated);
    };
  }, [mutateFiles]);

  const getFolderLabel = (folder: string) => {
    if (folder === FIXED_TAG) return t('library.folders.all');
    return folder;
  };

  const 过滤后的文件 = useMemo(() => {
    const 关键词 = searchQuery.trim();
    return files.filter((item) => {
      const 匹配标签 =
        selectedFolder === FIXED_TAG ||
        item.tags.includes(selectedFolder) ||
        item.fileName.includes(selectedFolder.slice(0, 2));
      const 匹配关键词 =
        关键词.length === 0 ||
        item.fileName.includes(关键词) ||
        (item.textSnippet ?? '').includes(关键词);
      return 匹配标签 && 匹配关键词;
    });
  }, [searchQuery, selectedFolder, files]);

  const 格式化时间 = (timeStr: string) => {
    const date = new Date(timeStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const handleCreateTag = async () => {
    const tagName = newTagName.trim();
    if (!tagName || 文件夹筛选项.includes(tagName)) { setIsAddingTag(false); setNewTagName(''); return; }
    try {
      await libraryService.createTag(tagName);
      set文件夹筛选项((prev) => [...prev, tagName]);
    } catch (err) {
      console.error('[Library] createTag error:', err);
    }
    setIsAddingTag(false);
    setNewTagName('');
  };

  const handleDeleteTag = async (tagName: string) => {
    if (tagName === FIXED_TAG) return;
    try {
      await libraryService.deleteTag(tagName);
      set文件夹筛选项((prev) => prev.filter((t) => t !== tagName));
      if (selectedFolder === tagName) setSelectedFolder(FIXED_TAG);
      await mutateFiles(
        (prev) => (prev ?? []).map((f) => ({ ...f, tags: f.tags.filter((t) => t !== tagName) })),
        false,
      );
    } catch (err) {
      console.error('[Library] deleteTag error:', err);
    }
  };

  const handleToggleSelectAll = () => {
    if (selectedItems.size === 过滤后的文件.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(过滤后的文件.map((item) => item.fileId)));
    }
  };

  const handleToggleItem = (itemId: string) => {
    setSelectedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) { newSet.delete(itemId); } else { newSet.add(itemId); }
      return newSet;
    });
  };

  const handleUploadClick = () => { if (!isBatchMode && scope === 'personal') fileInputRef.current?.click(); };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setIsUploading(true);
    setUploadError(null);
    try {
      const newFile = await libraryService.uploadFile(file);
      await mutateFiles((prev) => [newFile, ...(prev ?? [])], false);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : '上传失败');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      await Promise.all(Array.from(selectedItems).map((id) => libraryService.deleteFile(id)));
      await mutateFiles((prev) => (prev ?? []).filter((f) => !selectedItems.has(f.fileId)), false);
      setSelectedItems(new Set());
      setIsDeleteModalOpen(false);
      setIsBatchMode(false);
    } catch (err) {
      console.error('[Library] delete error:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRetry = async (fileId: string) => {
    try {
      await libraryService.retryEmbedding(fileId);
      await mutateFiles(
        (prev) => (prev ?? []).map((f) => f.fileId === fileId ? { ...f, embedStatus: 'processing' as EmbedStatus } : f),
        false,
      );
    } catch (err) {
      console.error('[Library] retry error:', err);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#F5F7FA]">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.md,.doc,.docx,.xls,.xlsx,image/jpeg,image/png,image/gif,image/webp"
        onChange={handleFileChange}
      />

      <div
        className="desktop-topbar px-6 flex items-center justify-between bg-white border-b border-gray-100"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="flex items-center gap-6" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <div className="w-72 bg-[#F5F7FA] rounded-2xl px-4 py-2.5 flex items-center gap-3 border border-gray-100">
            <Search size={18} className="text-gray-500" />
            <input
              type="text"
              placeholder={t('library.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent outline-none text-sm text-gray-700 placeholder-gray-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-3" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          {isBatchMode && (
            <>
              <button
                onClick={handleToggleSelectAll}
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white text-gray-900 border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                {selectedItems.size === 过滤后的文件.length && 过滤后的文件.length > 0 ? t('common.unselectAll') : t('common.selectAll')}
              </button>
              <button
                onClick={() => setIsMoveModalOpen(true)}
                disabled={selectedItems.size === 0}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  selectedItems.size === 0
                    ? 'bg-white text-gray-300 border border-gray-100 cursor-not-allowed'
                    : 'bg-white text-gray-900 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                {t('assets.move')}
              </button>
              <button
                onClick={() => setIsDeleteModalOpen(true)}
                disabled={selectedItems.size === 0}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  selectedItems.size === 0
                    ? 'bg-white text-gray-300 border border-gray-100 cursor-not-allowed'
                    : 'bg-white text-[#7678ee] border border-[#7678ee] hover:bg-[#7678ee]/10'
                }`}
              >
                {t('library.delete')}
              </button>
            </>
          )}
          
          {scope === 'personal' && (
            <>
              <button
                className={`w-9 h-9 rounded-lg transition-colors flex items-center justify-center ${
                  isBatchMode
                    ? 'bg-[#7678ee]/10 text-[#7678ee]'
                    : 'bg-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
                onClick={() => setIsBatchMode((prev) => !prev)}
                title={t('library.batchMode')}
              >
                <SquareMousePointer size={20} />
              </button>

              <button
                className={`w-9 h-9 rounded-lg transition-colors flex items-center justify-center ${
                  isBatchMode || isUploading
                    ? 'text-gray-300 cursor-not-allowed'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
                disabled={isBatchMode || isUploading}
                onClick={handleUploadClick}
                title={t('common.upload')}
              >
                {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="p-4">
        <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-1">
          {文件夹筛选项.map((folderItem) => {
            const isActive = selectedFolder === folderItem;

            return (
              <button
                key={folderItem}
                onClick={() => setSelectedFolder(folderItem)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${isActive
                  ? 'bg-[#2C2D33] text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-100'
                  }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  <span>{getFolderLabel(folderItem)}</span>
                  {isAddingTag && folderItem !== '全部' && (
                    <span
                      onMouseDown={(e) => {
                        e.preventDefault();
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTag(folderItem);
                      }}
                      className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full hover:bg-black/10"
                    >
                      <X size={10} />
                    </span>
                  )}
                </span>
              </button>
            );
          })}

          {isAddingTag ? (
            <input
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreateTag();
                }
                if (e.key === 'Escape') {
                  setIsAddingTag(false);
                  setNewTagName('');
                }
              }}
              onBlur={() => {
                setIsAddingTag(false);
                setNewTagName('');
              }}
              autoFocus
              placeholder={t('library.inputTag')}
              className="w-24 px-2.5 py-1.5 rounded-lg text-xs bg-white border border-gray-200 outline-none focus:border-[#2C2D33]"
            />
          ) : (
            <button
              onClick={() => setIsAddingTag(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white text-gray-600 hover:bg-gray-100 border border-gray-100 transition-colors"
              title={t('library.addTag')}
            >
              +
            </button>
          )}
        </div>

        {uploadError && (
          <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
            {uploadError}
          </div>
        )}

        <div className="grid grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2.5">
          {isLoading ? (
            <div className="col-span-full mt-8 flex justify-center">
              <Loader2 size={24} className="animate-spin text-gray-400" />
            </div>
          ) : (
            过滤后的文件.map((item) => {
              const dotClass = EMBED_DOT[item.embedStatus as EmbedStatus];
              return (
                <div
                  key={item.fileId}
                  onClick={() => {
                    if (isBatchMode) { handleToggleItem(item.fileId); return; }
                    setPreviewFile({ fileId: item.fileId, isOwner: scope === 'personal' });
                  }}
                  className="bg-white rounded-xl p-2 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="relative aspect-[3/4] rounded-lg bg-[#FAFBFC] overflow-hidden mb-2">
                    {/* 批量选择复选框 - 左上角 */}
                    {isBatchMode && (
                      <div
                        onClick={(e) => { e.stopPropagation(); handleToggleItem(item.fileId); }}
                        className={`absolute top-1.5 left-1.5 w-5 h-5 rounded flex items-center justify-center z-10 cursor-pointer transition-colors ${
                          selectedItems.has(item.fileId)
                            ? 'bg-[#7678ee]'
                            : 'bg-white border-2 border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        {selectedItems.has(item.fileId) && (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                    )}
                    {/* 文件格式标签 - 右上角 */}
                    <div className="absolute top-1.5 right-1.5 h-5 min-w-[36px] px-1.5 rounded bg-black/40 text-white text-[10px] font-medium flex items-center justify-center z-10">
                      {getFileTypeLabel(item.fileType)}
                    </div>
                    {/* 失败时显示重试按钮 */}
                    {item.embedStatus === 'failed' && !isBatchMode && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRetry(item.fileId); }}
                        className="absolute bottom-1.5 right-1.5 z-10 flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/50 text-white text-[10px] hover:bg-black/70 transition-colors"
                      >
                        <RefreshCw size={10} />
                        重试
                      </button>
                    )}
                    {item.thumbnailBase64 ? (
                      <img
                        src={item.thumbnailBase64}
                        alt={item.fileName}
                        className="w-full h-full object-cover"
                      />
                    ) : item.textSnippet ? (
                      <div className="w-full h-full p-3 overflow-hidden">
                        <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-[8]">
                          {item.textSnippet}
                        </p>
                      </div>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-2xl font-bold text-gray-200">
                          {getFileTypeLabel(item.fileType)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-start justify-between gap-1">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium text-sm text-gray-900 mb-1 truncate">{item.fileName}</h3>
                      <p className="text-xs text-gray-400 flex items-center justify-between">
                        <span>{格式化时间(item.updatedAt)}</span>
                      </p>
                    </div>
                    {/* 状态圆点 - 右下角，done 时不显示 */}
                    {dotClass && (
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${dotClass}`} />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {!isLoading && 过滤后的文件.length === 0 && (
          <div className="mt-8 text-center text-sm text-gray-400">{t('library.noMatchedFiles')}</div>
        )}
      </div>

      {/* 移动模态窗 */}
      <Modal
        isOpen={isMoveModalOpen}
        onClose={() => {
          setIsMoveModalOpen(false);
          setSelectedMoveTag('全部');
        }}
        title={t('library.moveTo')}
        confirmText={t('assets.move')}
        cancelText={t('common.cancel')}
        confirmButtonVariant="primary"
        onConfirm={async () => {
          const targetTag = selectedMoveTag === '全部' ? null : selectedMoveTag;
          await Promise.all(
            Array.from(selectedItems).map(async (id) => {
              const file = files.find((f) => f.fileId === id);
              if (!file) return;
              const allTags = 文件夹筛选项.filter((tg) => tg !== FIXED_TAG);
              const newTags = targetTag
                ? [...new Set([...file.tags.filter((tg) => !allTags.includes(tg)), targetTag])]
                : file.tags.filter((tg) => !allTags.includes(tg));
              await libraryService.updateFileTags(id, newTags);
              await mutateFiles(
                (prev) => (prev ?? []).map((f) => f.fileId === id ? { ...f, tags: newTags } : f),
                false,
              );
            })
          );
          setIsMoveModalOpen(false);
          setSelectedMoveTag('全部');
          setIsBatchMode(false);
          setSelectedItems(new Set());
        }}
      >
        <div className="space-y-3">
          <p className="text-gray-600">
            {t('library.moveFileMessage', { count: selectedItems.size })}
          </p>
          <div className="flex flex-wrap gap-2">
            {文件夹筛选项.map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedMoveTag(tag)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  selectedMoveTag === tag
                    ? 'bg-[#7678ee] text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-100'
                }`}
              >
                {getFolderLabel(tag)}
              </button>
            ))}
          </div>
        </div>
      </Modal>

      {/* 文件预览模态窗 */}
      <LibraryFilePreviewModal
        fileId={previewFile?.fileId ?? null}
        isOwner={previewFile?.isOwner ?? false}
        onClose={() => setPreviewFile(null)}
      />

      {/* 删除确认模态窗 */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title={t('library.deleteConfirm')}
        confirmText={isDeleting ? '删除中...' : t('library.delete')}
        cancelText={t('common.cancel')}
        confirmButtonVariant="danger"
        onConfirm={handleDeleteConfirm}
      >
        <p>
          {t('library.deleteFileMessage', { count: selectedItems.size })}
        </p>
        <p className="mt-2 text-gray-500">
          {t('library.deleteWarning')}
        </p>
      </Modal>
    </div>
  );
}

export default LibraryPage;
