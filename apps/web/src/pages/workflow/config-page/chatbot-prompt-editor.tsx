import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

import { Dialog, DialogContent, DialogTitle } from '../base/dialog';
import { cn } from '../utils/classnames';
import {
  findUndefinedVariableKeys,
  isValidPromptVariableKey,
  resolvePromptVariableMenuTrigger,
  type PromptVariableMenuTrigger,
} from './promptVariablesUtils';

const rowClass = 'text-sm leading-relaxed';
const padClass = 'px-3 py-2.5 pb-7';

const menuRowClass =
  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[14px] font-normal text-[#1D2939] transition-colors hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:outline-none';

/** 光标在视口中的位置（用于把补全菜单贴在 `{` 下方） */
function measureCaretClientRect(textarea: HTMLTextAreaElement, position: number): DOMRect {
  const cs = getComputedStyle(textarea);
  const taRect = textarea.getBoundingClientRect();
  const borderTop = parseFloat(cs.borderTopWidth) || 0;
  const borderLeft = parseFloat(cs.borderLeftWidth) || 0;
  const mirrorContent = [
    'position:absolute',
    'left:0',
    `top:${-textarea.scrollTop}px`,
    `width:${textarea.clientWidth}px`,
    'white-space:pre-wrap',
    'overflow-wrap:break-word',
    'word-break:break-word',
    `font:${cs.font}`,
    `line-height:${cs.lineHeight}`,
    `letter-spacing:${cs.letterSpacing}`,
    `padding:${cs.padding}`,
    'box-sizing:border-box',
    `text-align:${cs.textAlign}`,
    `direction:${cs.direction}`,
    'border:0',
    'margin:0',
  ].join(';');

  const clip = document.createElement('div');
  clip.setAttribute(
    'style',
    [
      'position:fixed',
      `top:${taRect.top + borderTop}px`,
      `left:${taRect.left + borderLeft}px`,
      `width:${textarea.clientWidth}px`,
      `height:${textarea.clientHeight}px`,
      'z-index:-1',
      'visibility:hidden',
      'overflow:hidden',
      'pointer-events:none',
    ].join(';'),
  );

  const inner = document.createElement('div');
  inner.setAttribute('style', mirrorContent);
  inner.textContent = textarea.value.slice(0, position);
  const span = document.createElement('span');
  span.textContent = textarea.value.slice(position) || ' ';
  inner.appendChild(span);
  clip.appendChild(inner);
  document.body.appendChild(clip);
  const r = span.getBoundingClientRect();
  document.body.removeChild(clip);
  return r;
}

export function IconBraceVar({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-blue-50 text-[10px] font-bold leading-none text-blue-600',
        className,
      )}
      aria-hidden
    >
      {'{x}'}
    </span>
  );
}

function highlightNodes(text: string): ReactNode[] {
  const re = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;
  const nodes: ReactNode[] = [];
  let last = 0;
  let k = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      nodes.push(text.slice(last, m.index));
    }
    nodes.push(
      <span key={`pv-hl-${k++}`} className="font-normal text-[#155EEF]">
        {m[0]}
      </span>,
    );
    last = m.index + m[0].length;
  }
  nodes.push(text.slice(last));
  return nodes;
}

export type ChatbotPromptEditorProps = {
  id: string;
  value: string;
  onChange: (next: string) => void;
  onBlurPersist: (next: string) => void;
  definedVariableKeys: readonly string[];
  onAddVariables: (keys: readonly string[]) => void;
  maxLength?: number;
  rows?: number;
  placeholder?: string;
};

export const ChatbotPromptEditor = ({
  id,
  value,
  onChange,
  onBlurPersist,
  definedVariableKeys,
  onAddVariables,
  maxLength = 6000,
  rows = 8,
  placeholder,
}: ChatbotPromptEditorProps) => {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const hlRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef(value);
  const selEndRef = useRef(0);

  const [menu, setMenu] = useState<PromptVariableMenuTrigger | null>(null);
  const [undefKeys, setUndefKeys] = useState<string[] | null>(null);
  const [menuScreenPos, setMenuScreenPos] = useState<{ top: number; left: number } | null>(null);
  const menuRef = useRef(menu);
  menuRef.current = menu;

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const syncScroll = useCallback(() => {
    const ta = taRef.current;
    const hl = hlRef.current;
    if (ta && hl) {
      hl.scrollTop = ta.scrollTop;
      hl.scrollLeft = ta.scrollLeft;
    }
  }, []);

  useLayoutEffect(() => {
    const ta = taRef.current;
    const hl = hlRef.current;
    if (ta && hl) {
      hl.style.height = `${ta.scrollHeight}px`;
    }
    syncScroll();
  }, [value, syncScroll]);

  const recomputeMenuScreenPos = useCallback(() => {
    const ta = taRef.current;
    if (!ta || !menuRef.current) {
      setMenuScreenPos(null);
      return;
    }
    const caretIndex = ta.selectionStart ?? 0;
    const r = measureCaretClientRect(ta, caretIndex);
    const gap = 3;
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const menuMinW = 220;
    const left = Math.min(r.left, Math.max(8, vw - menuMinW - 12));
    setMenuScreenPos({ top: r.bottom + gap, left });
  }, []);

  useLayoutEffect(() => {
    if (!menu) {
      setMenuScreenPos(null);
      return;
    }
    recomputeMenuScreenPos();
  }, [menu, value, recomputeMenuScreenPos]);

  useEffect(() => {
    if (!menuRef.current) {
      return;
    }
    const onWin = () => recomputeMenuScreenPos();
    window.addEventListener('scroll', onWin, true);
    window.addEventListener('resize', onWin);
    return () => {
      window.removeEventListener('scroll', onWin, true);
      window.removeEventListener('resize', onWin);
    };
  }, [menu, recomputeMenuScreenPos]);

  const openMenuIfAny = useCallback((nextVal: string, sel: number) => {
    setMenu(resolvePromptVariableMenuTrigger(nextVal, sel));
  }, []);

  const commitInsert = (rawKey: string) => {
    const key = rawKey.trim();
    if (!isValidPromptVariableKey(key) || !menu || !taRef.current) {
      return;
    }
    const ta = taRef.current;
    const end = Math.max(selEndRef.current, ta.selectionStart ?? 0);
    const v = valueRef.current;
    const token = `{{${key}}}`;
    let next: string;
    let pos: number;
    if (menu.kind === 'pair') {
      next = `${v.slice(0, menu.openStart)}${token}${v.slice(menu.replaceEnd)}`;
      pos = menu.openStart + token.length;
    } else {
      next = `${v.slice(0, menu.start)}${token}${v.slice(end)}`;
      pos = menu.start + token.length;
    }
    valueRef.current = next;
    onChange(next);
    setMenu(null);
    setMenuScreenPos(null);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(pos, pos);
    });
  };

  /** 「添加新变量」：把当前 `{…` / `{{…` 触发片段换成 `{{}}`，光标落在括号中间 */
  const commitEmptyDoubleBrace = () => {
    if (!menu || !taRef.current) {
      return;
    }
    const ta = taRef.current;
    const end = Math.max(selEndRef.current, ta.selectionStart ?? 0);
    const v = valueRef.current;
    const token = '{{}}';
    let next: string;
    let pos: number;
    if (menu.kind === 'pair') {
      next = `${v.slice(0, menu.openStart)}${token}${v.slice(menu.replaceEnd)}`;
      pos = menu.openStart + 2;
    } else {
      next = `${v.slice(0, menu.start)}${token}${v.slice(end)}`;
      pos = menu.start + 2;
    }
    valueRef.current = next;
    onChange(next);
    selEndRef.current = pos;
    setMenu(null);
    setMenuScreenPos(null);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(pos, pos);
    });
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    const sel = e.target.selectionStart ?? v.length;
    selEndRef.current = e.target.selectionEnd ?? sel;
    valueRef.current = v;
    onChange(v);
    openMenuIfAny(v, sel);
    syncScroll();
  };

  const handleKeyUp = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget;
    syncScroll();
    openMenuIfAny(ta.value, ta.selectionStart ?? 0);
  };

  const handleSelect = () => {
    const ta = taRef.current;
    if (ta) {
      selEndRef.current = ta.selectionEnd ?? ta.selectionStart ?? 0;
    }
    syncScroll();
    if (menuRef.current) {
      requestAnimationFrame(() => recomputeMenuScreenPos());
    }
  };

  const handleBlur = () => {
    setMenu(null);
    setMenuScreenPos(null);
    window.setTimeout(() => {
      const v = valueRef.current;
      const missing = findUndefinedVariableKeys(v, definedVariableKeys);
      if (missing.length > 0) {
        setUndefKeys(missing);
      } else {
        onBlurPersist(v);
      }
    }, 200);
  };

  const closeUndefModal = () => {
    setUndefKeys(null);
    onBlurPersist(valueRef.current);
  };

  const confirmUndefModal = () => {
    if (!undefKeys?.length) {
      return;
    }
    onAddVariables(undefKeys);
    setUndefKeys(null);
    onBlurPersist(valueRef.current);
  };

  const f = (menu?.filter ?? '').trim().toLowerCase();
  const menuKeys = f
    ? definedVariableKeys.filter((k) => k.toLowerCase().startsWith(f))
    : [...definedVariableKeys];
  const hasMenuKeyOptions = menuKeys.length > 0;

  return (
    <div className="relative">
      <div className="relative mt-2">
        <textarea
          ref={taRef}
          id={id}
          rows={rows}
          maxLength={maxLength}
          value={value}
          spellCheck={false}
          onChange={handleChange}
          onKeyUp={handleKeyUp}
          onSelect={handleSelect}
          onScroll={() => {
            syncScroll();
            recomputeMenuScreenPos();
          }}
          onBlur={handleBlur}
          placeholder={placeholder}
          className={cn(
            rowClass,
            padClass,
            'relative z-10 w-full resize-y overflow-auto rounded-xl border border-slate-200 bg-transparent text-transparent caret-[#1D2939] outline-none transition focus:border-sky-400 focus:ring-1 focus:ring-sky-300',
          )}
          style={{ WebkitTextFillColor: 'transparent' } as CSSProperties}
        />
        <div
          ref={hlRef}
          className={cn(
            rowClass,
            padClass,
            'pointer-events-none absolute left-0 top-0 z-0 w-full overflow-hidden whitespace-pre-wrap break-words rounded-xl border border-transparent bg-slate-50 font-normal text-[#1D2939] antialiased',
          )}
          aria-hidden
        >
          {highlightNodes(value)}
        </div>

        {menu && menuScreenPos ? (
        <div
          className="flex min-w-[240px] max-w-[min(320px,calc(100vw-16px))] flex-col rounded-[10px] border border-slate-200/90 bg-white shadow-[0_8px_28px_-6px_rgba(15,23,42,0.14)]"
          style={{
            position: 'fixed',
            top: menuScreenPos.top,
            left: menuScreenPos.left,
            zIndex: 1003,
          }}
          onMouseDown={(e) => e.preventDefault()}
          role="listbox"
          aria-label="插入变量"
        >
          {hasMenuKeyOptions ? (
            <div className="max-h-72 overflow-y-auto overflow-x-hidden p-1">
              {menuKeys.map((k) => (
                <button
                  key={k}
                  type="button"
                  role="option"
                  className={menuRowClass}
                  onClick={() => commitInsert(k)}
                >
                  <IconBraceVar />
                  <span className="min-w-0 flex-1 truncate font-normal">{k}</span>
                </button>
              ))}
            </div>
          ) : (
            <></>
          )}
          <div className="p-1">
              <button type="button" className={menuRowClass} onClick={() => commitEmptyDoubleBrace()}>
                <IconBraceVar />
                <span className="font-normal">添加新变量</span>
              </button>
            </div>
        </div>
      ) : null}
      </div>

      <Dialog open={undefKeys !== null} onOpenChange={(open) => !open && closeUndefModal()}>
        <DialogContent className="w-[min(420px,calc(100vw-1.5rem))] max-w-[calc(100vw-1rem)] p-0">
          <div className="flex gap-3 px-5 pb-4 pt-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-100 bg-amber-50 text-lg font-semibold text-amber-600 shadow-sm">
              {'{ }'}
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle>
                <span className="text-[15px] font-semibold text-slate-900">检测到未定义的变量</span>
              </DialogTitle>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                提示词中引用了未定义的变量，是否自动添加到用户输入表单（变量列表）中？
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(undefKeys ?? []).map((k) => (
                  <code
                    key={k}
                    className="rounded-lg bg-blue-50 px-2.5 py-1 text-[13px] font-semibold text-blue-700"
                  >{`{{${k}}}`}</code>
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
            <button
              type="button"
              onClick={closeUndefModal}
              className="rounded-xl border border-slate-200 bg-white px-5 py-2 text-[12px] font-semibold text-slate-600 transition hover:border-slate-300"
            >
              取消
            </button>
            <button
              type="button"
              onClick={confirmUndefModal}
              className="rounded-xl border border-blue-300 bg-blue-600 px-5 py-2 text-[12px] font-semibold text-white transition hover:bg-blue-500"
            >
              添加
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
