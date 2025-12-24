import * as React from 'react';
import { CodeBlock } from './CodeBlock';
import { isInsideOpenCodeFence } from './streamingMarkdown';

const createElement = React.createElement;

const extractText = (children: React.ReactNode): string => {
  if (typeof children === 'string') {
    return children;
  }

  if (Array.isArray(children)) {
    return children.map((child) => extractText(child)).join('');
  }

  if (React.isValidElement(children)) {
    return extractText(children.props.children);
  }

  return '';
};

export type MarkdownComponentsOptions = {
  isStreaming?: boolean;
  rawContent?: string;
};

export const createMarkdownComponents = (options: MarkdownComponentsOptions = {}) => {
  const { isStreaming = false, rawContent = '' } = options;
  const streamingInsideCode = isStreaming && isInsideOpenCodeFence(rawContent);

  return {
    h1: ({ children }: { children?: React.ReactNode }) => createElement(
      'h1',
      { className: 'mt-5 text-xl font-semibold leading-8 text-slate-900 first:mt-0' },
      children,
    ),
    h2: ({ children }: { children?: React.ReactNode }) => createElement(
      'h2',
      { className: 'mt-5 text-lg font-semibold leading-7 text-slate-900 first:mt-0' },
      children,
    ),
    h3: ({ children }: { children?: React.ReactNode }) => createElement(
      'h3',
      { className: 'mt-4 text-base font-semibold leading-7 text-slate-900 first:mt-0' },
      children,
    ),
    p: ({ children }: { children?: React.ReactNode }) => createElement(
      'p',
      { className: 'mt-3 leading-7 first:mt-0' },
      children,
    ),
    ul: ({ children }: { children?: React.ReactNode }) => createElement(
      'ul',
      { className: 'mt-3 list-disc space-y-1 pl-5 first:mt-0' },
      children,
    ),
    ol: ({ children }: { children?: React.ReactNode }) => createElement(
      'ol',
      { className: 'mt-3 list-decimal space-y-1 pl-5 first:mt-0' },
      children,
    ),
    li: ({ children }: { children?: React.ReactNode }) => createElement(
      'li',
      { className: 'leading-7' },
      children,
    ),
    blockquote: ({ children }: { children?: React.ReactNode }) => createElement(
      'blockquote',
      { className: 'mt-3 border-l-4 border-cyan-200 bg-cyan-50/60 px-4 py-2 text-slate-700 first:mt-0' },
      children,
    ),
    a: ({ href, children }: { href?: string; children?: React.ReactNode }) => {
      if (!href) {
        return createElement('span', null, children);
      }

      return createElement(
        'a',
        {
          href,
          target: '_blank',
          rel: 'noreferrer',
          className: 'font-medium text-cyan-700 underline decoration-cyan-300 underline-offset-4 transition hover:text-cyan-800',
        },
        children,
      );
    },
    table: ({ children }: { children?: React.ReactNode }) => createElement(
      'div',
      { className: 'mt-3 overflow-x-auto first:mt-0' },
      createElement(
        'table',
        { className: 'min-w-full border-collapse overflow-hidden rounded-xl border border-slate-200 text-left text-sm' },
        children,
      ),
    ),
    thead: ({ children }: { children?: React.ReactNode }) => createElement(
      'thead',
      { className: 'bg-slate-100 text-slate-700' },
      children,
    ),
    th: ({ children }: { children?: React.ReactNode }) => createElement(
      'th',
      { className: 'border border-slate-200 px-3 py-2 font-semibold' },
      children,
    ),
    td: ({ children }: { children?: React.ReactNode }) => createElement(
      'td',
      { className: 'border border-slate-200 px-3 py-2 align-top' },
      children,
    ),
    hr: () => createElement('hr', { className: 'my-4 border-slate-200' }),
    pre: ({ children }: { children?: React.ReactNode }) => children,
    code: ({ className, children }: { className?: string; children?: React.ReactNode }) => {
      const text = extractText(children);
      const languageMatch = /language-([\w+#-]+)/.exec(className ?? '');
      const isBlock = Boolean(languageMatch) || text.includes('\n');

      if (!isBlock) {
        return createElement(
          'code',
          { className: 'rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.92em] text-slate-800' },
          children,
        );
      }

      return createElement(CodeBlock, {
        code: text.replace(/\n$/, ''),
        language: languageMatch?.[1] ?? '',
        isStreaming: isStreaming || streamingInsideCode,
      });
    },
  };
};
