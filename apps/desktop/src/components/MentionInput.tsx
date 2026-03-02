import { useRef, useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';

interface MemberAgent {
  agentId: string;
  name: string;
  role: string;
  avatar?: string;
}

interface MentionInputProps {
  placeholder?: string;
  members?: MemberAgent[];
  onChange?: (text: string) => void;
}

export interface MentionInputHandle {
  getTextContent: () => string;
  getMentionedAgentIds: () => string[];
  clear: () => void;
}

const MentionInput = forwardRef<MentionInputHandle, MentionInputProps>(
function MentionInput({ placeholder = '输入消息...', members = [], onChange }: MentionInputProps, ref) {
  const fallbackAvatarUrl = `${import.meta.env.BASE_URL}dede.webp`;
  const editorRef = useRef<HTMLDivElement>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionRange, setMentionRange] = useState<Range | null>(null);

  const filteredMembers = mentionQuery !== null
    ? members.filter(a => a.name.toLowerCase().includes(mentionQuery.toLowerCase()))
    : [];

  const getCaretInfo = (): { query: string | null; atRange: Range | null } => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return { query: null, atRange: null };

    const range = sel.getRangeAt(0);
    if (!range.collapsed) return { query: null, atRange: null };

    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return { query: null, atRange: null };

    const text = node.textContent ?? '';
    const offset = range.startOffset;
    const textBefore = text.slice(0, offset);
    const atIndex = textBefore.lastIndexOf('@');

    if (atIndex === -1) return { query: null, atRange: null };

    const afterAt = textBefore.slice(atIndex + 1);
    if (afterAt.includes(' ') || afterAt.includes('\n')) return { query: null, atRange: null };

    const atRange = document.createRange();
    atRange.setStart(node, atIndex);
    atRange.setEnd(node, offset);

    return { query: afterAt, atRange };
  };

  const handleInput = useCallback(() => {
    const { query, atRange } = getCaretInfo();
    setMentionQuery(query);
    setMentionRange(atRange);
    onChange?.(editorRef.current?.innerText ?? '');
  }, [onChange]);

  const insertPlainTextAtCursor = (text: string) => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();

    const textNode = document.createTextNode(text);
    range.insertNode(textNode);

    const nextRange = document.createRange();
    nextRange.setStartAfter(textNode);
    nextRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(nextRange);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;
    insertPlainTextAtCursor(text);
    handleInputWithEmpty();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape' && mentionQuery !== null) {
      setMentionQuery(null);
      setMentionRange(null);
    }
  };

  const insertMention = (agent: MemberAgent) => {
    if (!mentionRange) return;

    const sel = window.getSelection();
    if (!sel) return;

    // 删除 @query 文字
    mentionRange.deleteContents();

    // 创建 @标签 span（contenteditable=false 使其成为原子块）
    const chip = document.createElement('span');
    chip.contentEditable = 'false';
    chip.dataset.mention = agent.agentId;
    chip.dataset.name = agent.name;
    chip.textContent = `@${agent.name}`;
    chip.className = [
      'inline-flex items-center',
      'bg-[#7678ee]/10 text-[#7678ee]',
      'rounded-md px-1.5 py-0.5',
      'text-sm font-medium',
      'mx-0.5',
      'select-all',
      'cursor-default',
    ].join(' ');

    // 插入 chip
    mentionRange.insertNode(chip);

    // 在 chip 后插入分隔空格 + 可编辑文本节点
    // 光标必须落在“文本节点内部”，否则 macOS 输入法可能把首字符当英文处理
    const separator = document.createTextNode(' ');
    const caretNode = document.createTextNode('');
    chip.after(separator, caretNode);

    // 将光标放进可编辑文本节点内部（offset=0）
    const newRange = document.createRange();
    newRange.setStart(caretNode, 0);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);

    setMentionQuery(null);
    setMentionRange(null);
    onChange?.(editorRef.current?.innerText ?? '');
  };

  useImperativeHandle(ref, () => ({
    getTextContent: () => {
      const el = editorRef.current;
      if (!el) return '';
      return (el.innerText ?? '').replace(/\u200B/g, '').trim();
    },
    getMentionedAgentIds: () => {
      const el = editorRef.current;
      if (!el) return [];
      // 按 chip 在 DOM 中出现的顺序提取 agentId，去重保留首次
      const seen = new Set<string>();
      const ids: string[] = [];
      el.querySelectorAll<HTMLElement>('[data-mention]').forEach((chip) => {
        const id = chip.dataset.mention;
        if (id && !seen.has(id)) {
          seen.add(id);
          ids.push(id);
        }
      });
      return ids;
    },
    clear: () => {
      if (editorRef.current) {
        editorRef.current.innerHTML = '';
      }
      setMentionQuery(null);
      setMentionRange(null);
      setIsEmpty(true);
    },
  }));

  // 点击外部关闭弹窗
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (editorRef.current && !editorRef.current.contains(e.target as Node)) {
        setMentionQuery(null);
        setMentionRange(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const [isEmpty, setIsEmpty] = useState(true);

  const handleInputWithEmpty = useCallback(() => {
    handleInput();
    const el = editorRef.current;
    setIsEmpty(!el || el.innerText.replace(/\u200B/g, '').trim() === '');
  }, [handleInput]);

  return (
    <div className="relative w-full">
      {/* @ 提及弹窗 */}
      {mentionQuery !== null && filteredMembers.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50">
          <div className="px-3 py-2 text-[11px] text-gray-400 font-medium border-b border-gray-50">
            频道成员
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filteredMembers.map((agent) => (
              <button
                key={agent.agentId}
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertMention(agent);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="w-7 h-7 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
                  {agent.avatar ? (
                    <img
                      src={agent.avatar}
                      alt={agent.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const img = e.target as HTMLImageElement;
                        if (!img.dataset.fallback) {
                          img.dataset.fallback = 'true';
                          img.src = fallbackAvatarUrl;
                        }
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs font-semibold">
                      {agent.name.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-gray-900">{agent.name}</span>
                  <span className="text-xs text-gray-400 ml-1.5">{agent.role}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 占位符 */}
      {isEmpty && (
        <div className="absolute top-0 left-0 text-sm text-gray-400 pointer-events-none select-none">
          {placeholder}
        </div>
      )}

      {/* 可编辑区域 */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInputWithEmpty}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        className="w-full min-h-[2.5rem] max-h-32 overflow-y-auto outline-none text-sm text-gray-900 leading-relaxed break-words"
        style={{ wordBreak: 'break-word' }}
      />
    </div>
  );
});

MentionInput.displayName = 'MentionInput';

export default MentionInput;
