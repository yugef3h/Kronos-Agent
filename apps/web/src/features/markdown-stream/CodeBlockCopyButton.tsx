import { useCallback, useRef, useState } from 'react';

type CodeBlockCopyButtonProps = {
  code: string;
};

export const CodeBlockCopyButton = ({ code }: CodeBlockCopyButtonProps) => {
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef<number | null>(null);

  const handleCopy = useCallback(async () => {
    if (!code) {
      return;
    }

    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);

      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }

      resetTimerRef.current = window.setTimeout(() => {
        setCopied(false);
        resetTimerRef.current = null;
      }, 2000);
    } catch {
      setCopied(false);
    }
  }, [code]);

  return (
    <button
      type="button"
      onClick={() => {
        void handleCopy();
      }}
      aria-label={copied ? '已复制' : '复制代码'}
      title={copied ? '已复制' : '复制代码'}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-800 hover:text-slate-100"
    >
      {copied ? (
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  );
};
