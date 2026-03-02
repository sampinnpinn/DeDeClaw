import { useCallback, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import {
  Aperture,
  BookMarked,
  FilePlus2,
  FileText,
  Loader2,
  Search,
  SquareMousePointer,
  Video,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Checkbox from '../components/Checkbox';
import DropdownMenu from '../components/DropdownMenu';
import Modal from '../components/Modal';
import Toast, { type ToastType } from '../components/Toast';
import { assetsService } from '../services/assetsService';
import { libraryService } from '../services/libraryService';
import type { Asset } from '../shared/types/asset';

const FIXED_TAG = '全部';
const LIBRARY_ALL_TAG = '全部';
const IMPORT_CONCURRENCY = 3;
const LIBRARY_FILES_UPDATED_EVENT = 'library:files-updated';

interface AssetsPageProps {
  onOpenAsset?: (assetId: string) => void;
}

function AssetsPage({ onOpenAsset }: AssetsPageProps) {
  const { t } = useTranslation();
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolder, setSelectedFolder] = useState(FIXED_TAG);
  const [文件夹筛选项, set文件夹筛选项] = useState<string[]>([FIXED_TAG]);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [selectedMoveTag, setSelectedMoveTag] = useState<string>(FIXED_TAG);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isKeepInAssets, setIsKeepInAssets] = useState(true);
  const [selectedLibraryTag, setSelectedLibraryTag] = useState<string>(LIBRARY_ALL_TAG);
  const [libraryTagOptions, setLibraryTagOptions] = useState<string[]>([LIBRARY_ALL_TAG]);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [isToastVisible, setIsToastVisible] = useState(false);
  const createButtonRef = useRef<HTMLButtonElement>(null);

  const fetchItems = useCallback(() => assetsService.getItems(), []);

  const { data: assets = [], isLoading, mutate: mutateAssets } = useSWR(
    'assets/items',
    fetchItems,
    {
      refreshInterval: (data) => {
        if (!data) return 3000;
        const hasActive = data.some(
          (a) => a.generationStatus === 'generating' || a.generationStatus === 'queued'
        );
        return hasActive ? 3000 : 0;
      },
      revalidateOnFocus: false,
    }
  );

  useSWR('assets/tags', () => assetsService.getTags(), {
    onSuccess: (tags) => set文件夹筛选项([FIXED_TAG, ...tags]),
    revalidateOnFocus: false,
  });

  const getFolderLabel = (folder: string) => {
    if (folder === FIXED_TAG) return t('assets.tags.all');
    return folder;
  };

  const showToast = (message: string, type: ToastType = 'success') => {
    setToast({ message, type });
    setIsToastVisible(true);
  };

  const sanitizeFileName = (value: string, fallbackId: string) => {
    const sanitized = value.replace(/[\\/:*?"<>|]/g, '_').trim();
    if (sanitized.length > 0) return sanitized;
    return `asset-${fallbackId}`;
  };

  const escapeFrontmatterValue = (value: string | null | undefined) => {
    if (!value) return '';
    return value
      .replace(/\\/g, '\\\\')
      .replace(/\r?\n/g, '\\n')
      .replace(/"/g, '\\"');
  };

  const buildAssetMarkdown = (asset: Asset) => {
    const title = asset.title?.trim() || '未命名资产';
    const summary = asset.summary?.trim() ?? '';
    const coverImage = asset.coverImage?.trim() ?? '';
    const tags = asset.tags ?? [];
    const content = asset.content ?? '';

    return [
      '---',
      `title: "${escapeFrontmatterValue(title)}"`,
      `summary: "${escapeFrontmatterValue(summary)}"`,
      `coverImage: "${escapeFrontmatterValue(coverImage)}"`,
      `assetTags: ${JSON.stringify(tags)}`,
      `assetType: "${escapeFrontmatterValue(asset.assetType)}"`,
      `assetId: "${escapeFrontmatterValue(asset.assetId)}"`,
      `createdAt: "${escapeFrontmatterValue(asset.createdAt)}"`,
      `updatedAt: "${escapeFrontmatterValue(asset.updatedAt)}"`,
      '---',
      '',
      `# ${title}`,
      '',
      content,
      '',
    ].join('\n');
  };

  const createMarkdownFileFromAsset = (asset: Asset) => {
    const markdown = buildAssetMarkdown(asset);
    const fileName = `${sanitizeFileName(asset.title, asset.assetId)}.md`;
    return new File([markdown], fileName, { type: 'text/markdown;charset=utf-8' });
  };

  const runTasksWithConcurrency = async (
    tasks: Array<() => Promise<void>>,
    limit: number
  ) => {
    if (tasks.length === 0) return;
    const workers = new Array(Math.min(limit, tasks.length)).fill(null).map(async () => {
      while (tasks.length > 0) {
        const task = tasks.shift();
        if (!task) return;
        await task();
      }
    });
    await Promise.all(workers);
  };

  const handleOpenImportModal = async () => {
    try {
      const tags = await libraryService.getTags();
      setLibraryTagOptions([LIBRARY_ALL_TAG, ...tags]);
    } catch (error: unknown) {
      console.error('[Assets] load library tags error:', error);
      setLibraryTagOptions([LIBRARY_ALL_TAG]);
      showToast(t('assets.loadLibraryTagsFailed'), 'error');
    }
    setSelectedLibraryTag(LIBRARY_ALL_TAG);
    setIsKeepInAssets(true);
    setIsImportModalOpen(true);
  };

  const handleImportToLibrary = async () => {
    if (isImporting) return;
    const selectedAssets = assets.filter((asset) => selectedItems.has(asset.assetId));
    if (selectedAssets.length === 0) {
      showToast(t('assets.noAssetSelected'), 'error');
      return;
    }

    setIsImporting(true);
    const targetTags = selectedLibraryTag === LIBRARY_ALL_TAG ? [] : [selectedLibraryTag];
    const importedAssetIds: string[] = [];
    let successCount = 0;
    let failedCount = 0;

    const uploadTasks = selectedAssets.map((asset) => async () => {
      try {
        const markdownFile = createMarkdownFileFromAsset(asset);
        await libraryService.uploadFile(markdownFile, targetTags);
        importedAssetIds.push(asset.assetId);
        successCount += 1;
      } catch (error: unknown) {
        failedCount += 1;
        console.error('[Assets] import asset to library error:', error);
      }
    });

    try {
      await runTasksWithConcurrency(uploadTasks, IMPORT_CONCURRENCY);
      if (successCount > 0) {
        window.dispatchEvent(new Event(LIBRARY_FILES_UPDATED_EVENT));
      }
      if (!isKeepInAssets && importedAssetIds.length > 0) {
        await assetsService.deleteItems(importedAssetIds);
        await mutateAssets();
      }

      if (failedCount === 0) {
        showToast(t('assets.importSuccess', { count: successCount }), 'success');
      } else {
        showToast(t('assets.importPartialFailed', { success: successCount, failed: failedCount }), 'error');
      }

      setIsImportModalOpen(false);
      setSelectedLibraryTag(LIBRARY_ALL_TAG);
      setIsKeepInAssets(true);
      setIsBatchMode(false);
      setSelectedItems(new Set());
    } catch (error: unknown) {
      console.error('[Assets] import to library failed:', error);
      showToast(t('assets.importFailed'), 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const 过滤后的资产 = useMemo(() => {
    const 关键词 = searchQuery.trim();
    return assets.filter((asset) => {
      const 匹配标签 =
        selectedFolder === FIXED_TAG ||
        asset.tags.includes(selectedFolder) ||
        asset.title.includes(selectedFolder.slice(0, 2));
      const 匹配关键词 =
        关键词.length === 0 ||
        asset.title.includes(关键词) ||
        asset.content.includes(关键词) ||
        asset.assetType.includes(关键词);
      return 匹配标签 && 匹配关键词;
    });
  }, [searchQuery, selectedFolder, assets]);

  const renderTypeIcon = (assetType: string) => {
    if (assetType === '文章') return <FileText size={16} className="text-gray-500" />;
    if (assetType === '笔记') return <BookMarked size={16} className="text-gray-500" />;
    if (assetType === '视频') return <Video size={16} className="text-gray-500" />;
    return <Aperture size={16} className="text-gray-500" />;
  };

  const 格式化时间 = (timeStr: string) => {
    const date = new Date(timeStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const handleCreateTag = async () => {
    const tagName = newTagName.trim();
    if (!tagName || 文件夹筛选项.includes(tagName)) { setIsAddingTag(false); setNewTagName(''); return; }
    try {
      await assetsService.createTag(tagName);
      set文件夹筛选项((prev) => [...prev, tagName]);
    } catch (err) {
      console.error('[Assets] createTag error:', err);
    }
    setIsAddingTag(false);
    setNewTagName('');
  };

  const handleDeleteTag = async (tagName: string) => {
    if (tagName === FIXED_TAG) return;
    try {
      await assetsService.deleteTag(tagName);
      set文件夹筛选项((prev) => prev.filter((t) => t !== tagName));
      if (selectedFolder === tagName) setSelectedFolder(FIXED_TAG);
      await mutateAssets();
    } catch (err) {
      console.error('[Assets] deleteTag error:', err);
    }
  };

  const handleToggleSelectAll = () => {
    if (selectedItems.size === 过滤后的资产.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(过滤后的资产.map((item) => item.assetId)));
    }
  };

  const handleToggleItem = (itemId: string) => {
    setSelectedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) { newSet.delete(itemId); } else { newSet.add(itemId); }
      return newSet;
    });
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      await assetsService.deleteItems(Array.from(selectedItems));
      await mutateAssets();
      setSelectedItems(new Set());
      setIsDeleteModalOpen(false);
      setIsBatchMode(false);
    } catch (err) {
      console.error('[Assets] delete error:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const isGenerating = (asset: Asset) =>
    asset.generationStatus === 'generating' || asset.generationStatus === 'queued';

  
  return (
    <div className="flex-1 flex flex-col bg-[#F5F7FA]">
      <div
        className="desktop-topbar px-6 flex items-center justify-between bg-white border-b border-gray-100"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="flex items-center gap-6" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <div className="w-72 bg-[#F5F7FA] rounded-2xl px-4 py-2.5 flex items-center gap-3 border border-gray-100">
            <Search size={18} className="text-gray-500" />
            <input
              type="text"
              placeholder="搜索"
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
                {selectedItems.size === 过滤后的资产.length && 过滤后的资产.length > 0 ? t('common.unselectAll') : t('common.selectAll')}
              </button>
              <button
                onClick={handleOpenImportModal}
                disabled={selectedItems.size === 0}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  selectedItems.size === 0
                    ? 'bg-white text-gray-300 border border-gray-100 cursor-not-allowed'
                    : 'bg-white text-gray-900 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                {t('assets.importToLibrary')}
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
                {t('assets.delete')}
              </button>
            </>
          )}

          <button
            className={`w-9 h-9 rounded-lg transition-colors flex items-center justify-center ${
              isBatchMode
                ? 'bg-[#7678ee]/10 text-[#7678ee]'
                : 'bg-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
            onClick={() => setIsBatchMode((prev) => !prev)}
            title={t('assets.batchMode')}
          >
            <SquareMousePointer size={20} />
          </button>

          <div className="relative">
            <button
              ref={createButtonRef}
              onClick={() => !isBatchMode && setIsCreateMenuOpen((prev) => !prev)}
              disabled={isBatchMode}
              className={`w-9 h-9 rounded-lg transition-colors flex items-center justify-center ${
                isBatchMode
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
              title={t('assets.createNew')}
            >
              <FilePlus2 size={18} />
            </button>
            {!isBatchMode && (
              <DropdownMenu
                items={[
                  { id: 'article', label: t('assets.types.article'), icon: <FileText size={16} />, onClick: async () => {
                    try {
                      const asset = await assetsService.createItem({ title: '新页面', assetType: '文章' });
                      await mutateAssets();
                      onOpenAsset?.(asset.assetId);
                    } catch (err) { console.error('[Assets] createItem error:', err); }
                  }},
                  { id: 'post', label: t('assets.types.note'), icon: <BookMarked size={16} />, onClick: () => undefined, disabled: true },
                  { id: 'video', label: t('assets.types.video'), icon: <Video size={16} />, onClick: () => undefined, disabled: true },
                  { id: 'image', label: t('assets.types.image'), icon: <Aperture size={16} />, onClick: () => undefined, disabled: true },
                ]}
                isOpen={isCreateMenuOpen}
                onClose={() => setIsCreateMenuOpen(false)}
                triggerRef={createButtonRef}
                align="right"
              />
            )}
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-1">
          {文件夹筛选项.map((tagItem) => {
            const isActive = selectedFolder === tagItem;

            return (
              <button
                key={tagItem}
                onClick={() => setSelectedFolder(tagItem)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${isActive
                  ? 'bg-[#2C2D33] text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-100'
                  }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  <span>{getFolderLabel(tagItem)}</span>
                  {isAddingTag && tagItem !== '全部' && (
                    <span
                      onMouseDown={(e) => {
                        e.preventDefault();
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTag(tagItem);
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
              placeholder={t('assets.tagNamePlaceholder')}
              className="w-24 px-2.5 py-1.5 rounded-lg text-xs bg-white border border-gray-200 outline-none focus:border-[#2C2D33]"
            />
          ) : (
            <button
              onClick={() => setIsAddingTag(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white text-gray-600 hover:bg-gray-100 border border-gray-100 transition-colors"
              title={t('assets.addTag')}
            >
              +
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {isLoading ? (
            <div className="col-span-full mt-8 flex justify-center">
              <Loader2 size={24} className="animate-spin text-gray-400" />
            </div>
          ) : 过滤后的资产.map((asset) => {
            const generating = isGenerating(asset);
            const isError = asset.generationStatus === 'error';
            return (
              <div
                key={asset.assetId}
                onClick={() => {
                  if (generating) return;
                  if (isBatchMode) { handleToggleItem(asset.assetId); return; }
                  onOpenAsset?.(asset.assetId);
                }}
                className={`bg-white rounded-2xl p-2.5 shadow-sm border border-gray-100 transition-shadow ${
                  generating ? 'cursor-not-allowed opacity-80' : 'hover:shadow-md cursor-pointer'
                }`}
              >
                <div className="relative aspect-video rounded-xl border border-gray-100 bg-[#FAFBFC] overflow-hidden">
                  {/* 批量选择复选框 - 左上角 */}
                  {isBatchMode && !generating && (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleItem(asset.assetId);
                      }}
                      className={`absolute top-1.5 left-1.5 w-5 h-5 rounded flex items-center justify-center z-10 cursor-pointer transition-colors ${
                        selectedItems.has(asset.assetId)
                          ? 'bg-[#7678ee]'
                          : 'bg-white border-2 border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      {selectedItems.has(asset.assetId) && (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                  )}

                  {/* 生成中/队列中遮罩 */}
                  {generating && (
                    <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center gap-2 z-10">
                      {asset.generationStatus === 'queued' ? (
                        <>
                          <Loader2 size={20} className="text-gray-400 animate-spin" />
                          <span className="text-xs text-gray-500 font-medium">队列中</span>
                        </>
                      ) : (
                        <>
                          <div className="w-3/4">
                            <div className="flex justify-between mb-1">
                              <span className="text-xs text-gray-500">AI 创作中</span>
                              <span className="text-xs font-semibold text-[#7678ee]">{asset.generationProgress}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-[#7678ee] rounded-full transition-all duration-500"
                                style={{ width: `${asset.generationProgress}%` }}
                              />
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* 错误标识 */}
                  {isError && (
                    <div className="absolute top-1.5 right-1.5 z-10 bg-red-100 text-red-500 text-[10px] px-1.5 py-0.5 rounded font-medium">
                      生成失败
                    </div>
                  )}

                  {asset.coverImage ? (
                    <img src={asset.coverImage} alt={asset.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full p-4 text-xs text-gray-500 leading-5">
                      {asset.content}
                    </div>
                  )}
                </div>

                <div className="pt-3 px-1">
                  <div className="flex items-center gap-2 text-gray-700">
                    {renderTypeIcon(asset.assetType)}
                    <h3 className="font-medium text-sm text-gray-900 truncate">{asset.title}</h3>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <p className="text-xs text-gray-400">{格式化时间(asset.createdAt)}</p>
                    {asset.shareToken && asset.shareExpiresAt && new Date(asset.shareExpiresAt) > new Date() && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-medium leading-none">已分享</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {!isLoading && 过滤后的资产.length === 0 && (
          <div className="mt-8 text-center text-sm text-gray-400">{t('common.noData')}</div>
        )}
      </div>

      {/* 移动模态窗 */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => {
          if (isImporting) return;
          setIsImportModalOpen(false);
          setSelectedLibraryTag(LIBRARY_ALL_TAG);
          setIsKeepInAssets(true);
        }}
        title={t('assets.importToLibrary')}
        confirmText={isImporting ? t('assets.importing') : t('common.confirm')}
        cancelText={t('common.cancel')}
        confirmButtonVariant="primary"
        onConfirm={handleImportToLibrary}
        footerLeft={(
          <Checkbox
            checked={isKeepInAssets}
            onChange={setIsKeepInAssets}
            label={t('assets.keepInAssets')}
            labelPlacement="right"
            className="gap-2 text-sm text-gray-600 select-none"
          />
        )}
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            {t('assets.importToLibraryMessage', { count: selectedItems.size })}
          </p>
          <div>
            <p className="mb-2 text-xs font-medium text-gray-500">{t('assets.selectLibraryTag')}</p>
            <div className="flex flex-wrap gap-2">
              {libraryTagOptions.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setSelectedLibraryTag(tag)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    selectedLibraryTag === tag
                      ? 'bg-[#7678ee] text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-100'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* 移动模态窗 */}
      <Modal
        isOpen={isMoveModalOpen}
        onClose={() => {
          setIsMoveModalOpen(false);
          setSelectedMoveTag(FIXED_TAG);
        }}
        title={t('assets.moveToTag')}
        confirmText={t('assets.move')}
        cancelText={t('common.cancel')}
        confirmButtonVariant="primary"
        onConfirm={async () => {
          const targetTag = selectedMoveTag === FIXED_TAG ? null : selectedMoveTag;
          await Promise.all(
            Array.from(selectedItems).map(async (id) => {
              const asset = assets.find((a) => a.assetId === id);
              if (!asset) return;
              const allTags = 文件夹筛选项.filter((tg) => tg !== FIXED_TAG);
              const newTags = targetTag
                ? [...new Set([...asset.tags.filter((tg) => !allTags.includes(tg)), targetTag])]
                : asset.tags.filter((tg) => !allTags.includes(tg));
              await assetsService.updateAssetTags(id, newTags);
            })
          );
          await mutateAssets();
          setIsMoveModalOpen(false);
          setSelectedMoveTag(FIXED_TAG);
          setIsBatchMode(false);
          setSelectedItems(new Set());
        }}
      >
        <div className="space-y-3">
          <p className="text-gray-600">
            {t('assets.moveToTag')}（{t('assets.selected', { count: selectedItems.size })}）
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

      {/* 删除确认模态窗 */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title={t('assets.deleteConfirm')}
        confirmText={isDeleting ? '删除中...' : t('assets.delete')}
        cancelText={t('common.cancel')}
        confirmButtonVariant="danger"
        onConfirm={handleDeleteConfirm}
      >
        <p>
          {t('assets.deleteMessage', { count: selectedItems.size })}
        </p>
      </Modal>

      <Toast
        message={toast?.message ?? ''}
        type={toast?.type ?? 'success'}
        isVisible={isToastVisible}
        onClose={() => setIsToastVisible(false)}
      />
    </div>
  );
}

export default AssetsPage;
