import { useDeferredValue, useMemo } from 'react';
import { highlightCodeBlock, normalizeHighlightLanguage } from './codeHighlight';

type CodeBlockProps = {
  code: string;
  language?: string;
  isStreaming?: boolean;
};

export const CodeBlock = ({ code, language = '', isStreaming = false }: CodeBlockProps) => {
  const deferredCode = useDeferredValue(code);
  const normalizedLanguage = normalizeHighlightLanguage(language);

  const highlightedHtml = useMemo(
    () => highlightCodeBlock(deferredCode, normalizedLanguage),
    [deferredCode, normalizedLanguage],
  );

  return (
    <div className="markdown-code-block group relative mt-3 first:mt-0">
      {normalizedLanguage !== 'plaintext' ? (
        <div className="flex items-center justify-between rounded-t-2xl border border-b-0 border-slate-800 bg-slate-900 px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] text-slate-400">
          <span>{normalizedLanguage}</span>
          {isStreaming ? <span className="text-cyan-400/90">输出中</span> : null}
        </div>
      ) : null}
      <pre
        className={`overflow-x-auto rounded-2xl bg-slate-950 px-4 py-3 text-[13px] leading-6 text-slate-100 shadow-inner ${
          normalizedLanguage !== 'plaintext' ? 'rounded-t-none border border-t-0 border-slate-800' : ''
        }`}
      >
        <code
          className={`hljs block font-mono whitespace-pre ${normalizedLanguage !== 'plaintext' ? `language-${normalizedLanguage}` : ''}`}
          dangerouslySetInnerHTML={{ __html: highlightedHtml }}
        />
        {isStreaming ? (
          <span className="ml-0.5 inline-block animate-pulse text-cyan-400" aria-hidden>
            |
          </span>
        ) : null}
      </pre>
    </div>
  );
};
