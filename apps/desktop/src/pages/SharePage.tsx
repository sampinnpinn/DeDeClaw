import { useState, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { Markdown } from 'tiptap-markdown';
import { Loader2, FileText, Tag } from 'lucide-react';
import { API_BASE_URL } from '../services/apiBase';

interface ShareData {
  assetId: string;
  title: string;
  content: string;
  summary: string;
  tags: string[];
  coverImage: string | null;
  createdAt: string;
  shareExpiresAt: string | null;
}

function SharePage() {
  const logoUrl = `${import.meta.env.BASE_URL}logo.png`;
  const [data, setData] = useState<ShareData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const token = new URLSearchParams(window.location.search).get('token');

  const editor = useEditor({
    extensions: [StarterKit, Markdown, Link.configure({ openOnClick: true }), Image],
    content: '',
    editable: false,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: 'article-prose min-h-[200px] focus:outline-none' },
    },
  });

  useEffect(() => {
    if (!token) { setError('无效的分享链接'); setIsLoading(false); return; }
    fetch(`${API_BASE_URL}/share/${token}`)
      .then((r) => r.json())
      .then((res: { success: boolean; data?: ShareData; message?: string }) => {
        if (!res.success || !res.data) { setError(res.message ?? '分享链接不存在或已失效'); return; }
        setData(res.data);
      })
      .catch(() => setError('加载失败，请稍后重试'))
      .finally(() => setIsLoading(false));
  }, [token]);

  useEffect(() => {
    if (editor && data?.content) {
      editor.commands.setContent(data.content);
    }
  }, [editor, data?.content]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 size={28} className="animate-spin text-gray-300" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-3">
        <FileText size={40} className="text-gray-300" />
        <p className="text-gray-500 text-sm">{error ?? '内容不存在'}</p>
      </div>
    );
  }

  return (
    <>
    <div className="h-[calc(100vh-3rem)] bg-white flex overflow-hidden">
      {/* 左侧主内容 */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="w-full max-w-[900px] mx-auto px-12 py-12">
          {data.coverImage && (
            <div className="w-full aspect-video rounded-2xl overflow-hidden mb-8">
              <img
                src={data.coverImage}
                alt={data.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <h1 className="text-[32px] font-bold text-gray-900 leading-tight mb-6">{data.title}</h1>
          <div className="h-[1px] bg-gray-100 mb-6" />
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* 右侧面板（只读） */}
      <div className="w-[260px] shrink-0 border-l border-gray-100 bg-white overflow-y-auto">
        <div className="p-5 space-y-6">
          {/* 摘要 */}
          {data.summary && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">摘要</p>
              <p className="text-sm text-gray-600 leading-relaxed">{data.summary}</p>
            </div>
          )}

          {/* 标签 */}
          {data.tags.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">标签</p>
              <div className="flex flex-wrap gap-1.5">
                {data.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-xs text-gray-600"
                  >
                    <Tag size={10} />
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 创建时间 */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">创建时间</p>
            <p className="text-xs text-gray-500">{new Date(data.createdAt).toLocaleString('zh-CN')}</p>
          </div>

          {/* 过期时间 */}
          {data.shareExpiresAt && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">分享过期</p>
              <p className="text-xs text-[#7678ee]">{new Date(data.shareExpiresAt).toLocaleString('zh-CN')}</p>
            </div>
          )}
        </div>
      </div>
    </div>

    {/* 固定底部横条 */}
    <div className="fixed bottom-0 left-0 right-0 h-12 bg-black/70 backdrop-blur-sm flex items-center justify-center gap-1.5 z-50">
      <span className="text-white/70 text-sm font-medium tracking-wide">Built with</span>
      <img src={logoUrl} alt="DeDe" className="w-5 h-5 object-contain rounded-sm" />
      <span className="text-white text-sm font-semibold tracking-wide">DeDe</span>
    </div>
    </>
  );
}

export default SharePage;
