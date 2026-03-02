import { useState, useRef, useEffect, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { Markdown } from 'tiptap-markdown';
import {
    ArrowLeft,
    Cloud,
    CloudUpload,
    Check,
    Download,
    FileText,
    Loader2,
    Send,
    Code,
    Eye,
    PanelRightOpen,
    PanelRightClose,
    X,
    Upload,
    CheckCircle2,
    Link2,
    Bold,
    Italic,
    Strikethrough,
    Code as CodeIcon,
    List,
    ListOrdered,
    Quote,
    Link as LinkIcon,
    ChevronDown,
    ImagePlus,
} from 'lucide-react';
import { assetsService } from '../services/assetsService';
import { API_BASE_URL } from '../services/apiBase';
import Toast from '../components/Toast';
import Modal from '../components/Modal';
import type { CoverGenerationStatus } from '../shared/types/asset';

interface ArticlePageProps {
    assetId: string;
    onBack: () => void;
}

type RightPanelTab = 'details' | 'publish';
type SaveStatus = 'idle' | 'saving' | 'saved';

const getDesktopPortFromEnv = (): string => {
    const value = import.meta.env.VITE_DESKTOP_PORT;
    if (!value || value.trim().length === 0) {
        throw new Error('[Desktop ArticlePage] 缺少必要环境变量：VITE_DESKTOP_PORT');
    }

    return value;
};

const DESKTOP_PORT = getDesktopPortFromEnv();

const isLoopbackHost = (host: string): boolean => host === 'localhost' || host === '127.0.0.1';

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

function ArticlePage({ assetId, onBack }: ArticlePageProps) {
    const [isPageLoading, setIsPageLoading] = useState(true);
    const [createdAt, setCreatedAt] = useState('');
    const [updatedAt, setUpdatedAt] = useState('');

    const [title, setTitle] = useState('新页面');
    const [content, setContent] = useState('');
    const [isRightPaneVisible, setIsRightPaneVisible] = useState(true);
    const [isMarkdownMode, setIsMarkdownMode] = useState(false);
    const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>('details');
    const [summary, setSummary] = useState('');
    const [tags, setTags] = useState<string[]>([]);
    const [newTag, setNewTag] = useState('');
    const [isAddingTag, setIsAddingTag] = useState(false);
    const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [isShared, setIsShared] = useState(false);
    const [shareToken, setShareToken] = useState<string | null>(null);
    const [shareExpiresAt, setShareExpiresAt] = useState<string | null>(null);
    const [isShareLoading, setIsShareLoading] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [isToastVisible, setIsToastVisible] = useState(false);
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
    const [coverImage, setCoverImage] = useState<string | undefined>(undefined);
    const [coverReferenceImage, setCoverReferenceImage] = useState<string | null>(null);
    const [coverGenerationStatus, setCoverGenerationStatus] = useState<CoverGenerationStatus>('idle');
    const [coverGenerationProgress, setCoverGenerationProgress] = useState(0);
    const [coverGenerationError, setCoverGenerationError] = useState<string | null>(null);
    const [, setCoverGenerationStyle] = useState<string | null>(null);
    const [isCoverPreviewOpen, setIsCoverPreviewOpen] = useState(false);
    const [isDeleteCoverModalOpen, setIsDeleteCoverModalOpen] = useState(false);
    const [isDeletingCover, setIsDeletingCover] = useState(false);
    const [markdownSource, setMarkdownSource] = useState('');

    // BubbleMenu link input state
    const [isLinkInputOpen, setIsLinkInputOpen] = useState(false);
    const [linkUrl, setLinkUrl] = useState('');
    const [isHeadingMenuOpen, setIsHeadingMenuOpen] = useState(false);

    const titleTextareaRef = useRef<HTMLTextAreaElement>(null);
    const summaryTextareaRef = useRef<HTMLTextAreaElement>(null);
    const contentTextareaRef = useRef<HTMLTextAreaElement>(null);
    const downloadMenuRef = useRef<HTMLDivElement>(null);
    const shareMenuRef = useRef<HTMLDivElement>(null);
    const coverInputRef = useRef<HTMLInputElement>(null);
    const coverReferenceInputRef = useRef<HTMLInputElement>(null);
    const linkInputRef = useRef<HTMLInputElement>(null);
    const headingMenuRef = useRef<HTMLDivElement>(null);
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Always-fresh refs for save
    const latestTitle = useRef(title);
    const latestContent = useRef(content);
    const latestSummary = useRef(summary);
    const latestTags = useRef(tags);
    const latestCoverImage = useRef<string | undefined | null>(coverImage);
    const latestCoverReferenceImage = useRef<string | null>(coverReferenceImage);
    const saveContentRef = useRef<() => void>(() => {});

    // Tiptap editor
    const editor = useEditor({
        extensions: [
            StarterKit,
            Markdown,
            Placeholder.configure({
                placeholder: '开始写作...',
            }),
            Link.configure({
                openOnClick: false,
                HTMLAttributes: { class: '' },
            }),
            Image,
        ],
        content: '',  // 初始为空，加载后通过 editor.commands.setContent 更新
        immediatelyRender: false,
        editorProps: {
            attributes: {
                class: 'article-prose min-h-[500px] focus:outline-none',
            },
        },
        onUpdate: ({ editor: ed }) => {
            const md = (ed.storage as any).markdown.getMarkdown();
            setContent(md);
            setMarkdownSource(md);
            latestContent.current = md;
            saveContentRef.current();
        },
    });

    // Load asset from backend
    useEffect(() => {
        assetsService.getItem(assetId).then((asset) => {
            setTitle(asset.title);
            setContent(asset.content);
            setMarkdownSource(asset.content);
            setSummary(asset.summary ?? '');
            setTags(asset.tags);
            setCoverImage(asset.coverImage ?? undefined);
            setCoverReferenceImage(null);
            setCoverGenerationStatus(asset.coverGenerationStatus ?? 'idle');
            setCoverGenerationProgress(asset.coverGenerationProgress ?? 0);
            setCoverGenerationError(asset.coverGenerationError ?? null);
            setCoverGenerationStyle(asset.coverGenerationStyle ?? null);
            setCreatedAt(new Date(asset.createdAt).toLocaleString('zh-CN'));
            setUpdatedAt(new Date(asset.updatedAt).toLocaleString('zh-CN'));
            if (asset.shareToken && asset.shareExpiresAt && new Date(asset.shareExpiresAt) > new Date()) {
                setIsShared(true);
                setShareToken(asset.shareToken);
                setShareExpiresAt(asset.shareExpiresAt);
            }
            if (editor) {
                editor.commands.setContent(asset.content);
            }
            setIsPageLoading(false);
        }).catch((err) => {
            console.error('[ArticlePage] loadAsset error:', err);
            setIsPageLoading(false);
        });
    }, [assetId]);

    // Sync editor content after load
    useEffect(() => {
        if (!isPageLoading && editor && content) {
            editor.commands.setContent(content);
        }
    }, [isPageLoading]);

    // Keep refs in sync with state
    useEffect(() => { latestTitle.current = title; }, [title]);
    useEffect(() => { latestContent.current = content; }, [content]);
    useEffect(() => { latestSummary.current = summary; }, [summary]);
    useEffect(() => { latestTags.current = tags; }, [tags]);
    useEffect(() => { latestCoverImage.current = coverImage; }, [coverImage]);
    useEffect(() => { latestCoverReferenceImage.current = coverReferenceImage; }, [coverReferenceImage]);

    const isCoverGenerating = coverGenerationStatus === 'pending' || coverGenerationStatus === 'running';

    const saveContent = useCallback(() => {
        setSaveStatus('saving');
        if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

        saveTimeoutRef.current = setTimeout(() => {
            fetch(`${API_BASE_URL}/assets/items/${assetId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('auth_token') ?? ''}` },
                body: JSON.stringify({
                    title: latestTitle.current,
                    content: latestContent.current,
                    summary: latestSummary.current,
                    tags: latestTags.current,
                    coverImage: latestCoverImage.current,
                    coverReferenceImage: latestCoverReferenceImage.current,
                }),
            }).catch(() => {});
            setSaveStatus('saved');
            savedTimeoutRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
        }, 1500);
    }, [assetId]);

    // Keep saveContentRef in sync so onUpdate closure always has latest version
    saveContentRef.current = saveContent;

    // Trigger save on title/summary/tags/coverImage change
    useEffect(() => { if (!isPageLoading) saveContent(); }, [title]);
    useEffect(() => { if (!isPageLoading) saveContent(); }, [summary]);
    useEffect(() => { if (!isPageLoading) saveContent(); }, [tags]);
    useEffect(() => { if (!isPageLoading) saveContent(); }, [coverImage]);
    useEffect(() => { if (!isPageLoading) saveContent(); }, [coverReferenceImage]);
    useEffect(() => {
        if (isPageLoading) return;
        if (coverReferenceImage !== null) return;
        saveContent();
    }, [isPageLoading, coverReferenceImage, saveContent]);

    // Auto-adjust title height
    useEffect(() => {
        if (titleTextareaRef.current) {
            titleTextareaRef.current.style.height = 'auto';
            titleTextareaRef.current.style.height = `${titleTextareaRef.current.scrollHeight}px`;
        }
    }, [title]);

    // Auto-adjust content textarea height when switching to markdown mode
    useEffect(() => {
        if (isMarkdownMode && contentTextareaRef.current) {
            contentTextareaRef.current.style.height = 'auto';
            contentTextareaRef.current.style.height = `${contentTextareaRef.current.scrollHeight}px`;
        }
    }, [isMarkdownMode, markdownSource]);

    // Auto-adjust summary height
    useEffect(() => {
        if (summaryTextareaRef.current) {
            summaryTextareaRef.current.style.height = 'auto';
            summaryTextareaRef.current.style.height = `${summaryTextareaRef.current.scrollHeight}px`;
        }
    }, [summary]);

    // Close menus on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (downloadMenuRef.current && !downloadMenuRef.current.contains(event.target as Node)) {
                setIsDownloadMenuOpen(false);
            }
            if (shareMenuRef.current && !shareMenuRef.current.contains(event.target as Node)) {
                setIsShareModalOpen(false);
            }
            if (headingMenuRef.current && !headingMenuRef.current.contains(event.target as Node)) {
                setIsHeadingMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Focus link input
    useEffect(() => {
        if (isLinkInputOpen && linkInputRef.current) {
            linkInputRef.current.focus();
        }
    }, [isLinkInputOpen]);

    // 分享链接过期自动重置
    useEffect(() => {
        if (!shareExpiresAt || !isShared) return;
        const ms = new Date(shareExpiresAt).getTime() - Date.now();
        if (ms <= 0) { setIsShared(false); setShareToken(null); setShareExpiresAt(null); return; }
        const timer = setTimeout(() => {
            setIsShared(false);
            setShareToken(null);
            setShareExpiresAt(null);
            showToast('分享链接已过期', 'error');
        }, ms);
        return () => clearTimeout(timer);
    }, [shareExpiresAt, isShared]);

    // Cleanup timeouts
    useEffect(() => {
        return () => {
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
            if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
        };
    }, []);

    const handleAddTag = () => {
        const trimmed = newTag.trim();
        if (trimmed && !tags.includes(trimmed)) {
            setTags(prev => [...prev, trimmed]);
        }
        setNewTag('');
        setIsAddingTag(false);
    };

    const handleRemoveTag = (tag: string) => {
        setTags(prev => prev.filter(t => t !== tag));
    };

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type });
        setIsToastVisible(true);
    };

    const getShareUrl = (token: string): string => {
        const configuredShareHost = import.meta.env.VITE_DESKTOP_SHARE_HOST;
        if (configuredShareHost && configuredShareHost.trim().length > 0) {
            return `${trimTrailingSlash(configuredShareHost.trim())}/share?token=${token}`;
        }

        const protocol = window.location.protocol === 'file:' ? 'http:' : window.location.protocol;
        const currentHost = window.location.hostname;
        if (!isLoopbackHost(currentHost)) {
            return `${protocol}//${currentHost}:${DESKTOP_PORT}/share?token=${token}`;
        }

        try {
            const apiHost = new URL(API_BASE_URL).hostname;
            if (!isLoopbackHost(apiHost)) {
                return `${protocol}//${apiHost}:${DESKTOP_PORT}/share?token=${token}`;
            }
        } catch {
            // ignore invalid API_BASE_URL and fallback to localhost
        }

        return `${protocol}//localhost:${DESKTOP_PORT}/share?token=${token}`;
    };

    const handleShare = async () => {
        setIsShareLoading(true);
        try {
            const result = await assetsService.shareAsset(assetId);
            setIsShared(true);
            setShareToken(result.shareToken);
            setShareExpiresAt(result.shareExpiresAt);
            setIsShareModalOpen(false);
            await navigator.clipboard.writeText(getShareUrl(result.shareToken));
            showToast('已复制分享链接');
        } catch (err) {
            console.error('[ArticlePage] shareAsset error:', err);
            showToast('分享失败', 'error');
        } finally {
            setIsShareLoading(false);
        }
    };

    const handleUnshare = async () => {
        try {
            await assetsService.unshareAsset(assetId);
            setIsShared(false);
            setShareToken(null);
            setShareExpiresAt(null);
            setIsShareModalOpen(false);
        } catch (err) {
            console.error('[ArticlePage] unshareAsset error:', err);
            showToast('取消分享失败', 'error');
        }
    };

    const handleCopyShareLink = async () => {
        if (!shareToken) return;
        await navigator.clipboard.writeText(getShareUrl(shareToken));
        setIsShareModalOpen(false);
        showToast('已复制分享链接');
    };

    // Mode switch
    const handleToggleMarkdown = () => {
        if (!isMarkdownMode && editor) {
            // Entering markdown mode: get latest markdown from editor
            const md = (editor.storage as any).markdown.getMarkdown();
            setMarkdownSource(md);
        } else if (isMarkdownMode && editor) {
            // Leaving markdown mode: sync markdown source back to editor
            editor.commands.setContent(markdownSource);
        }
        setIsMarkdownMode(!isMarkdownMode);
    };

    // Handle markdown source change in textarea
    const handleMarkdownSourceChange = (value: string) => {
        setMarkdownSource(value);
        setContent(value);
        latestContent.current = value;
        saveContent();
    };

    // Cover image upload handler
    const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = ev.target?.result as string;
            setCoverImage(img);
        };
        reader.readAsDataURL(file);
    };

    const handleRemoveCoverReference = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        setCoverReferenceImage(null);
        showToast('参考图已删除');
    };

    const handleRemoveCover = () => {
        if (isCoverGenerating) {
            showToast('封面生成中，暂不可删除', 'error');
            return;
        }
        setIsDeleteCoverModalOpen(true);
    };

    const handleConfirmRemoveCover = async () => {
        if (isDeletingCover) return;
        setIsDeletingCover(true);
        try {
            await assetsService.updateAsset(assetId, { coverImage: null });
            latestCoverImage.current = null;
            setCoverImage(undefined);
            setIsCoverPreviewOpen(false);
            setIsDeleteCoverModalOpen(false);
            showToast('封面已删除');
        } catch (err) {
            console.error('[ArticlePage] removeCover error:', err);
            showToast(err instanceof Error ? err.message : '删除封面失败', 'error');
        } finally {
            setIsDeletingCover(false);
        }
    };

    const handleCoverReferenceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = ev.target?.result;
            if (typeof img === 'string') {
                setCoverReferenceImage(img);
                showToast('参考图已上传');
            }
        };
        reader.onerror = () => {
            showToast('参考图读取失败', 'error');
        };
        reader.readAsDataURL(file);
    };

    const syncCoverGenerationStatus = useCallback(async () => {
        try {
            const status = await assetsService.getCoverGenerationStatus(assetId);
            setCoverGenerationStatus(status.coverGenerationStatus);
            setCoverGenerationProgress(status.coverGenerationProgress);
            setCoverGenerationError(status.coverGenerationError ?? null);
            setCoverGenerationStyle(status.coverGenerationStyle ?? null);
            if (status.hasReferenceImage !== Boolean(coverReferenceImage)) {
                setCoverReferenceImage(status.hasReferenceImage ? latestCoverReferenceImage.current : null);
            }
            if (status.coverImage) {
                setCoverImage(status.coverImage);
            }
            if (status.coverGenerationStatus === 'succeeded') {
                setCoverReferenceImage(null);
                showToast('封面生成成功');
            }
            if (status.coverGenerationStatus === 'failed' && status.coverGenerationError) {
                showToast(status.coverGenerationError, 'error');
            }
        } catch (err) {
            console.error('[ArticlePage] getCoverGenerationStatus error:', err);
        }
    }, [assetId]);

    const handleGenerateCover = async () => {
        if (isCoverGenerating) {
            showToast('封面正在生成中，请稍后', 'error');
            return;
        }
        setCoverGenerationError(null);
        try {
            await assetsService.generateCover(assetId, {
                referenceImage: coverReferenceImage ?? undefined,
            });
            setCoverGenerationStatus('pending');
            setCoverGenerationProgress(10);
            showToast('已开始生成封面');
            await syncCoverGenerationStatus();
        } catch (err) {
            console.error('[ArticlePage] generateCover error:', err);
            showToast(err instanceof Error ? err.message : '触发封面生成失败', 'error');
        }
    };

    useEffect(() => {
        if (isPageLoading) return;
        if (!isCoverGenerating) return;
        const timer = setInterval(() => {
            syncCoverGenerationStatus().catch((err) => {
                console.error('[ArticlePage] cover status polling error:', err);
            });
        }, 10000);
        return () => clearInterval(timer);
    }, [isPageLoading, isCoverGenerating, syncCoverGenerationStatus]);

    const handleDownloadMd = () => {
        setIsDownloadMenuOpen(false);
        const mdContent = `# ${title}\n\n${content}`;
        const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title || '文章'}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleDownloadPdf = async () => {
        setIsDownloadMenuOpen(false);
        const htmlContent = editor?.getHTML() ?? content.replace(/\n/g, '<br/>');
        const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', sans-serif; padding: 40px 60px; color: #111; line-height: 1.8; font-size: 14px; }
    h1 { font-size: 28px; font-weight: bold; margin-bottom: 24px; }
    h2 { font-size: 22px; font-weight: bold; margin: 20px 0 12px; }
    h3 { font-size: 18px; font-weight: bold; margin: 16px 0 8px; }
    p { margin: 0 0 12px; }
    ul, ol { margin: 0 0 12px; padding-left: 24px; }
    li { margin-bottom: 4px; }
    blockquote { border-left: 3px solid #ddd; margin: 12px 0; padding: 4px 16px; color: #555; }
    code { background: #f5f5f5; padding: 2px 4px; border-radius: 3px; font-size: 13px; font-family: monospace; }
    pre { background: #f5f5f5; padding: 12px; border-radius: 6px; margin: 12px 0; }
    strong { font-weight: bold; }
    em { font-style: italic; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  ${htmlContent}
</body>
</html>`;

        if (window.electronAPI) {
            await window.electronAPI.exportPdf(html, title);
        } else {
            // 浏览器环境降级：新窗口打印
            const pw = window.open('', '_blank', 'width=900,height=700');
            if (!pw) return;
            pw.document.write(html);
            pw.document.close();
            pw.focus();
            setTimeout(() => { pw.print(); pw.close(); }, 300);
        }
    };

    const charCount = content.length;

    if (isPageLoading) {
        return (
            <div className="flex-1 flex items-center justify-center bg-white">
                <Loader2 size={28} className="animate-spin text-gray-300" />
            </div>
        );
    }

    return (
        <>
        <div className="flex-1 flex overflow-hidden bg-white">
            {/* Left Column: Main Content */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Header (Left) */}
                <header
                    className="desktop-topbar-compact px-4 flex items-center border-b border-gray-100 bg-white z-10 shrink-0"
                    style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
                >
                    {/* Back + Save status */}
                    <div
                        className="flex items-center gap-3"
                        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                    >
                        <button
                            onClick={onBack}
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                            title="返回"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div className="flex items-center gap-1.5 text-xs text-gray-400">
                            {saveStatus === 'saving' ? (
                                <>
                                    <CloudUpload size={16} strokeWidth={1.5} className="text-gray-400 animate-pulse" />
                                    <span>保存中...</span>
                                </>
                            ) : saveStatus === 'saved' ? (
                                <>
                                    <Check size={16} strokeWidth={2} className="text-emerald-500" />
                                    <span className="text-emerald-500">已保存</span>
                                </>
                            ) : (
                                <Cloud size={16} strokeWidth={1.5} className="text-gray-300" />
                            )}
                        </div>
                    </div>

                    <div className="flex-1" />

                    {/* Download + Share + (Conditional) Toggle Open */}
                    <div
                        className="flex items-center gap-1"
                        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                    >
                        {/* Markdown / Preview Toggle */}
                        <button
                            onClick={handleToggleMarkdown}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                            title={isMarkdownMode ? '预览' : 'Markdown'}
                        >
                            {isMarkdownMode ? <Eye size={18} /> : <Code size={18} />}
                            <span className="text-sm">{isMarkdownMode ? '预览' : 'Markdown'}</span>
                        </button>

                        {/* Download */}
                        <div className="relative" ref={downloadMenuRef}>
                            <button
                                onClick={() => setIsDownloadMenuOpen(prev => !prev)}
                                className="flex items-center gap-2 px-3 py-2 rounded-xl text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                            >
                                <Download size={18} />
                                <span className="text-sm">下载</span>
                            </button>
                            {isDownloadMenuOpen && (
                                <div className="absolute top-full right-0 mt-2 bg-white rounded-xl shadow-lg border border-gray-100 py-2 min-w-[160px] z-50">
                                    <button
                                        onClick={handleDownloadMd}
                                        className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                                    >
                                        <FileText size={16} />
                                        <span>Markdown</span>
                                    </button>
                                    <button
                                        onClick={handleDownloadPdf}
                                        className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                                    >
                                        <FileText size={16} />
                                        <span>PDF</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Share */}
                        <div className="relative" ref={shareMenuRef}>
                            <button
                                onClick={() => setIsShareModalOpen(prev => !prev)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-colors ${isShared
                                    ? 'text-emerald-600 hover:bg-emerald-50'
                                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                                    }`}
                            >
                                {isShared ? <CheckCircle2 size={18} /> : <Upload size={18} />}
                                <span className="text-sm">{isShared ? '已分享' : '分享'}</span>
                            </button>

                            {/* Share modal */}
                            {isShareModalOpen && (
                                <div className="absolute top-full right-0 mt-2 w-[320px] bg-white rounded-2xl shadow-xl border border-gray-100 p-5 z-50">
                                    {!isShared ? (
                                        <>
                                            <h3 className="text-base font-bold text-gray-900 mb-2">分享文档</h3>
                                            <p className="text-sm text-gray-500 leading-relaxed mb-5">
                                                分享文档的只读版本。链接将在 12 小时后过期。
                                            </p>
                                            <button
                                                onClick={handleShare}
                                                disabled={isShareLoading}
                                                className="w-full py-3 rounded-xl bg-[#7678ee] text-white font-semibold text-sm hover:bg-[#e5574c] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                                            >
                                                {isShareLoading && <Loader2 size={16} className="animate-spin" />}
                                                分享文档
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <h3 className="text-base font-bold text-gray-900 mb-2">文档已分享</h3>
                                            <p className="text-sm text-gray-500 leading-relaxed mb-3">
                                                文档已设为只读分享。复制链接以分享给协作者。
                                            </p>
                                            {shareExpiresAt && (
                                                <p className="text-xs text-[#7678ee] mb-4">
                                                    过期时间: {new Date(shareExpiresAt).toLocaleString('zh-CN')}
                                                </p>
                                            )}
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={handleUnshare}
                                                    className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                                                >
                                                    取消分享
                                                </button>
                                                <button
                                                    onClick={handleCopyShareLink}
                                                    className="flex-[1.5] py-2.5 rounded-xl bg-[#7678ee] text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#e5574c] transition-colors"
                                                >
                                                    <Link2 size={16} />
                                                    复制链接
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Open Toggle (Only visible when panel is hidden) */}
                        {!isRightPaneVisible && (
                            <>
                                <div className="w-px h-5 bg-gray-200 mx-2" />
                                <button
                                    onClick={() => setIsRightPaneVisible(true)}
                                    className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 transition-colors"
                                    title="打开面板"
                                >
                                    <PanelRightOpen size={18} />
                                </button>
                            </>
                        )}
                    </div>
                </header>

                {/* Main Content Body */}
                <main className="flex-1 overflow-y-auto">
                    <div className="w-full max-w-[900px] mx-auto px-12 pb-6">
                        {/* Title */}
                        <div className="pt-10 pb-4">
                            <textarea
                                ref={titleTextareaRef}
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full text-[32px] font-bold text-gray-900 border-none outline-none placeholder:text-gray-300 bg-transparent leading-tight focus:ring-0 resize-none whitespace-normal break-words overflow-hidden"
                                placeholder="文章标题"
                                rows={1}
                                onInput={(e) => {
                                    const el = e.currentTarget;
                                    el.style.height = 'auto';
                                    el.style.height = `${el.scrollHeight}px`;
                                }}
                            />
                        </div>

                        <div className="h-[1px] bg-gray-100 mb-6" />

                        {isMarkdownMode ? (
                            <div className="flex-1 min-h-[500px]">
                                <textarea
                                    ref={contentTextareaRef}
                                    value={markdownSource}
                                    onChange={(e) => handleMarkdownSourceChange(e.target.value)}
                                    className="w-full text-[14px] font-mono text-gray-700 border-none outline-none leading-relaxed bg-transparent resize-none overflow-hidden"
                                    placeholder="Markdown 源码..."
                                    onInput={(e) => {
                                        const el = e.currentTarget;
                                        el.style.height = 'auto';
                                        el.style.height = `${el.scrollHeight}px`;
                                    }}
                                />
                            </div>
                        ) : (
                            <div className="min-h-[500px]">
                                {/* BubbleMenu */}
                                {editor && (
                                    <BubbleMenu
                                        editor={editor}
                                        options={{ placement: 'top' }}
                                        className="bubble-menu flex items-center gap-0.5 bg-white border border-gray-200 rounded-lg shadow-xl p-1"
                                    >
                                        {/* Bold */}
                                        <button
                                            onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBold().run(); }}
                                            className={`p-1.5 rounded hover:bg-gray-100 transition-colors ${editor.isActive('bold') ? 'text-gray-900 bg-gray-100' : 'text-gray-500'}`}
                                            title="粗体"
                                        >
                                            <Bold size={16} strokeWidth={2.5} />
                                        </button>
                                        {/* Italic */}
                                        <button
                                            onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleItalic().run(); }}
                                            className={`p-1.5 rounded hover:bg-gray-100 transition-colors ${editor.isActive('italic') ? 'text-gray-900 bg-gray-100' : 'text-gray-500'}`}
                                            title="斜体"
                                        >
                                            <Italic size={16} strokeWidth={2.5} />
                                        </button>
                                        {/* Strikethrough */}
                                        <button
                                            onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleStrike().run(); }}
                                            className={`p-1.5 rounded hover:bg-gray-100 transition-colors ${editor.isActive('strike') ? 'text-gray-900 bg-gray-100' : 'text-gray-500'}`}
                                            title="删除线"
                                        >
                                            <Strikethrough size={16} strokeWidth={2.5} />
                                        </button>
                                        {/* Inline Code */}
                                        <button
                                            onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleCode().run(); }}
                                            className={`p-1.5 rounded hover:bg-gray-100 transition-colors ${editor.isActive('code') ? 'text-gray-900 bg-gray-100' : 'text-gray-500'}`}
                                            title="行内代码"
                                        >
                                            <CodeIcon size={16} strokeWidth={2.5} />
                                        </button>

                                        <div className="w-[1px] h-4 bg-gray-200 mx-1" />

                                        {/* Link */}
                                        <div className="relative">
                                            <button
                                                onMouseDown={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    if (editor.isActive('link')) {
                                                        editor.chain().focus().unsetLink().run();
                                                    } else {
                                                        setLinkUrl(editor.getAttributes('link').href || '');
                                                        setIsLinkInputOpen(!isLinkInputOpen);
                                                    }
                                                }}
                                                className={`p-1.5 rounded hover:bg-gray-100 transition-colors ${editor.isActive('link') ? 'text-gray-900 bg-gray-100' : 'text-gray-500'}`}
                                                title="链接"
                                            >
                                                <LinkIcon size={16} strokeWidth={2.5} />
                                            </button>
                                            {isLinkInputOpen && (
                                                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl p-2 z-50 flex items-center gap-2">
                                                    <input
                                                        ref={linkInputRef}
                                                        type="text"
                                                        value={linkUrl}
                                                        onChange={(e) => setLinkUrl(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                if (linkUrl) {
                                                                    editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run();
                                                                }
                                                                setIsLinkInputOpen(false);
                                                                setLinkUrl('');
                                                            } else if (e.key === 'Escape') {
                                                                setIsLinkInputOpen(false);
                                                                setLinkUrl('');
                                                                editor.chain().focus().run();
                                                            }
                                                        }}
                                                        placeholder="https://..."
                                                        className="w-48 px-2 py-1 text-[12px] border border-gray-200 rounded-md outline-none focus:border-gray-400 bg-white"
                                                    />
                                                    <button
                                                        onMouseDown={(e) => {
                                                            e.preventDefault();
                                                            if (linkUrl) {
                                                                editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run();
                                                            }
                                                            setIsLinkInputOpen(false);
                                                            setLinkUrl('');
                                                        }}
                                                        className="px-2 py-1 text-[11px] bg-gray-900 text-white rounded-md hover:bg-black transition-colors"
                                                    >
                                                        确定
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        <div className="w-[1px] h-4 bg-gray-200 mx-1" />

                                        {/* Heading */}
                                        <div className="relative" ref={headingMenuRef}>
                                            <button
                                                onMouseDown={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    setIsHeadingMenuOpen(!isHeadingMenuOpen);
                                                }}
                                                className={`p-1.5 rounded hover:bg-gray-100 transition-colors flex items-center gap-0.5 ${editor.isActive('heading') ? 'text-gray-900 bg-gray-100' : 'text-gray-500'}`}
                                                title="标题"
                                            >
                                                <span className="text-[13px] font-bold min-w-[18px]">
                                                    {editor.isActive('heading', { level: 1 }) ? 'H1' :
                                                        editor.isActive('heading', { level: 2 }) ? 'H2' :
                                                            editor.isActive('heading', { level: 3 }) ? 'H3' : 'H'}
                                                </span>
                                                <ChevronDown size={12} />
                                            </button>
                                            {isHeadingMenuOpen && (
                                                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl py-1 z-50 min-w-[80px]">
                                                    {([1, 2, 3] as const).map((level) => (
                                                        <button
                                                            key={level}
                                                            onMouseDown={(e) => {
                                                                e.preventDefault();
                                                                editor.chain().focus().toggleHeading({ level }).run();
                                                                setIsHeadingMenuOpen(false);
                                                            }}
                                                            className={`w-full text-left px-3 py-1.5 text-[13px] hover:bg-gray-50 transition-colors ${editor.isActive('heading', { level }) ? 'text-gray-900 font-bold bg-gray-100' : 'text-gray-700'}`}
                                                        >
                                                            H{level}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="w-[1px] h-4 bg-gray-200 mx-1" />

                                        {/* Bullet List */}
                                        <button
                                            onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBulletList().run(); }}
                                            className={`p-1.5 rounded hover:bg-gray-100 transition-colors ${editor.isActive('bulletList') ? 'text-gray-900 bg-gray-100' : 'text-gray-500'}`}
                                            title="无序列表"
                                        >
                                            <List size={16} strokeWidth={2.5} />
                                        </button>
                                        {/* Ordered List */}
                                        <button
                                            onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleOrderedList().run(); }}
                                            className={`p-1.5 rounded hover:bg-gray-100 transition-colors ${editor.isActive('orderedList') ? 'text-gray-900 bg-gray-100' : 'text-gray-500'}`}
                                            title="有序列表"
                                        >
                                            <ListOrdered size={16} strokeWidth={2.5} />
                                        </button>
                                        {/* Blockquote */}
                                        <button
                                            onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBlockquote().run(); }}
                                            className={`p-1.5 rounded hover:bg-gray-100 transition-colors ${editor.isActive('blockquote') ? 'text-gray-900 bg-gray-100' : 'text-gray-500'}`}
                                            title="引用"
                                        >
                                            <Quote size={16} strokeWidth={2.5} />
                                        </button>
                                    </BubbleMenu>
                                )}
                                <EditorContent editor={editor} />
                            </div>
                        )}
                    </div>
                </main>


            </div>

            {/* Right Column: Sidebar */}
            <aside
                className={`flex flex-col bg-white border-l border-gray-100 transition-all duration-300 ease-in-out ${isRightPaneVisible ? 'w-[380px]' : 'w-0 overflow-hidden border-none'
                    }`}
            >
                {/* Header (Right) */}
                <div
                    className="desktop-topbar-compact px-4 flex items-center justify-between border-b border-gray-100 bg-white shrink-0 min-w-[380px]"
                    style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
                >
                    <div
                        className="flex items-center gap-1"
                        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                    >
                        {/* Tab icons */}
                        <button
                            onClick={() => setRightPanelTab('details')}
                            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${rightPanelTab === 'details'
                                ? 'text-gray-800 bg-gray-100'
                                : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                                }`}
                            title="详情"
                        >
                            <FileText size={20} />
                        </button>
                        <button
                            onClick={() => setRightPanelTab('publish')}
                            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${rightPanelTab === 'publish'
                                ? 'text-gray-800 bg-gray-100'
                                : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                                }`}
                            title="发布"
                        >
                            <Send size={20} />
                        </button>
                    </div>

                    {/* Close Toggle */}
                    <button
                        onClick={() => setIsRightPaneVisible(false)}
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 transition-colors"
                        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                        title="收起面板"
                    >
                        <PanelRightClose size={18} />
                    </button>
                </div>

                {/* Sidebar Body */}
                <div className="flex-1 overflow-y-auto p-5 min-w-[380px]">
                    {rightPanelTab === 'details' && (
                        <div className="space-y-6">
                            {/* Cover */}
                            <div>
                                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">封面</h3>
                                <input
                                    type="file"
                                    ref={coverInputRef}
                                    onChange={handleCoverUpload}
                                    accept="image/*"
                                    className="hidden"
                                />
                                <input
                                    type="file"
                                    ref={coverReferenceInputRef}
                                    onChange={handleCoverReferenceUpload}
                                    accept="image/*"
                                    className="hidden"
                                />
                                {coverImage ? (
                                    <div className="relative group rounded-xl overflow-hidden border border-gray-100">
                                        <img src={coverImage} alt="封面" className="w-full aspect-video object-cover" />
                                        {isCoverGenerating ? (
                                            <div className="absolute inset-0 bg-black/35 flex items-center justify-center">
                                                <div className="px-3 py-1.5 rounded-lg bg-black/55 text-white text-xs font-medium">
                                                    AI 正在生成封面（{coverGenerationProgress}%）
                                                </div>
                                            </div>
                                        ) : null}
                                        {/* 悬浮底部工具栏 */}
                                        <div className={`absolute bottom-0 left-0 right-0 px-3 py-2.5 transition-opacity flex items-center justify-center gap-1.5 ${isCoverGenerating ? 'opacity-0 pointer-events-none' : 'opacity-0 group-hover:opacity-100'}`}>
                                            <button
                                                onClick={() => setIsCoverPreviewOpen(true)}
                                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-black/40 hover:bg-black/55 text-white text-xs font-medium transition-colors"
                                            >
                                                <Eye size={13} />
                                                查看
                                            </button>
                                            <button
                                                onClick={handleGenerateCover}
                                                disabled={isCoverGenerating}
                                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-black/40 hover:bg-black/55 text-white text-xs font-medium transition-colors"
                                            >
                                                <Send size={13} />
                                                {isCoverGenerating ? '生成中' : 'AI'}
                                            </button>
                                            <div className="relative">
                                                <button
                                                    onClick={() => coverReferenceInputRef.current?.click()}
                                                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${coverReferenceImage
                                                        ? 'bg-emerald-500/70 hover:bg-emerald-500/85 text-white'
                                                        : 'bg-black/40 hover:bg-black/55 text-white'
                                                        }`}
                                                    title="上传参考图"
                                                >
                                                    <ImagePlus size={13} />
                                                </button>
                                                {coverReferenceImage ? (
                                                    <button
                                                        type="button"
                                                        onClick={handleRemoveCoverReference}
                                                        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-black/70 hover:bg-black/85 text-white flex items-center justify-center transition-colors"
                                                        title="删除参考图"
                                                    >
                                                        <X size={10} />
                                                    </button>
                                                ) : null}
                                            </div>
                                            <button
                                                onClick={() => coverInputRef.current?.click()}
                                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-black/40 hover:bg-black/55 text-white text-xs font-medium transition-colors"
                                            >
                                                <Upload size={13} />
                                                更换
                                            </button>
                                            <button
                                                onClick={handleRemoveCover}
                                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-black/40 hover:bg-black/55 text-white text-xs font-medium transition-colors"
                                            >
                                                <X size={13} />
                                                删除
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="rounded-xl border-2 border-dashed border-gray-200 aspect-video flex items-center justify-center text-gray-400">
                                        {isCoverGenerating ? (
                                            <div className="text-xs text-gray-500">AI 正在生成封面，请稍候（{coverGenerationProgress}%）</div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={handleGenerateCover}
                                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-medium transition-colors"
                                                >
                                                    <Send size={13} />
                                                    AI
                                                </button>
                                                <div className="relative">
                                                    <button
                                                        onClick={() => coverReferenceInputRef.current?.click()}
                                                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${coverReferenceImage
                                                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                                            : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                                                            }`}
                                                        title="上传参考图"
                                                    >
                                                        <ImagePlus size={13} />
                                                    </button>
                                                    {coverReferenceImage ? (
                                                        <button
                                                            type="button"
                                                            onClick={handleRemoveCoverReference}
                                                            className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-gray-700 hover:bg-gray-800 text-white flex items-center justify-center transition-colors"
                                                            title="删除参考图"
                                                        >
                                                            <X size={10} />
                                                        </button>
                                                    ) : null}
                                                </div>
                                                <button
                                                    onClick={() => coverInputRef.current?.click()}
                                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-medium transition-colors"
                                                >
                                                    <Upload size={13} />
                                                    本地上传
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {coverGenerationError ? (
                                    <div className="mt-1 text-[11px] text-red-500">{coverGenerationError}</div>
                                ) : null}
                            </div>

                            {/* Summary */}
                            <div>
                                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">摘要</h3>
                                <textarea
                                    ref={summaryTextareaRef}
                                    value={summary}
                                    onChange={(e) => setSummary(e.target.value)}
                                    placeholder="写一段简短的摘要..."
                                    className="w-full px-3 py-2.5 rounded-xl border border-gray-100 bg-white text-sm text-gray-700 placeholder:text-gray-400 outline-none focus:border-gray-200 resize-none leading-relaxed overflow-hidden"
                                    onInput={(e) => {
                                        const el = e.currentTarget;
                                        el.style.height = 'auto';
                                        el.style.height = `${el.scrollHeight}px`;
                                    }}
                                />
                            </div>

                            {/* Tags */}
                            <div>
                                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">标签</h3>
                                <div className="flex flex-wrap gap-2">
                                    {tags.map((tag) => (
                                        <span
                                            key={tag}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white text-gray-600 border border-gray-100"
                                        >
                                            {tag}
                                            <button
                                                onClick={() => handleRemoveTag(tag)}
                                                className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full hover:bg-black/10 text-gray-400 hover:text-gray-600 transition-colors"
                                            >
                                                <X size={10} />
                                            </button>
                                        </span>
                                    ))}
                                    {isAddingTag ? (
                                        <input
                                            value={newTag}
                                            onChange={(e) => setNewTag(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleAddTag();
                                                if (e.key === 'Escape') {
                                                    setIsAddingTag(false);
                                                    setNewTag('');
                                                }
                                            }}
                                            autoFocus
                                            placeholder="标签名称"
                                            className="w-24 px-2.5 py-1.5 rounded-lg text-xs bg-white border border-gray-200 outline-none focus:border-[#2C2D33]"
                                        />
                                    ) : (
                                        <button
                                            onClick={() => setIsAddingTag(true)}
                                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white text-gray-600 hover:bg-gray-100 border border-gray-100 transition-colors"
                                        >
                                            +
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Info */}
                            <div>
                                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">信息</h3>
                                <div className="space-y-2.5">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-gray-400">类型</span>
                                        <span className="text-gray-700 font-medium">文章</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-gray-400">创建时间</span>
                                        <span className="text-gray-700">{createdAt}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-gray-400">更新时间</span>
                                        <span className="text-gray-700">{updatedAt}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-gray-400">字符数</span>
                                        <span className="text-gray-700">{charCount.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {rightPanelTab === 'publish' && (
                        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                            <Send size={32} className="mb-3 text-gray-300" />
                            <p className="text-sm font-medium">发布记录</p>
                            <p className="text-xs mt-1">暂无发布记录</p>
                        </div>
                    )}
                </div>
            </aside>
        </div>

        {/* 封面图预览蒙层 */}
        {isCoverPreviewOpen && coverImage && (
            <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
                onClick={() => setIsCoverPreviewOpen(false)}
            >
                <button
                    onClick={() => setIsCoverPreviewOpen(false)}
                    className="absolute top-5 right-5 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                >
                    <X size={20} />
                </button>
                <img
                    src={coverImage}
                    alt="封面预览"
                    className="max-w-[85vw] max-h-[85vh] rounded-xl object-contain shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                />
            </div>
        )}
        {toast && (
            <Toast
                message={toast.message}
                type={toast.type}
                isVisible={isToastVisible}
                onClose={() => setIsToastVisible(false)}
            />
        )}
        <Modal
            isOpen={isDeleteCoverModalOpen}
            onClose={() => {
                if (isDeletingCover) return;
                setIsDeleteCoverModalOpen(false);
            }}
            title="删除封面图"
            onConfirm={handleConfirmRemoveCover}
            confirmText={isDeletingCover ? '删除中...' : '确认删除'}
            cancelText="取消"
            confirmButtonVariant="danger"
        >
            <p>确认删除当前封面图吗？删除后不可恢复。</p>
        </Modal>
        </>
    );
}

export default ArticlePage;
