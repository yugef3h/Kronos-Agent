import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';

type MarkdownMessageProps = {
  content: string;
  isIncomplete?: boolean;
};

const createElement = React.createElement;

const markdownComponents = {
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
  pre: ({ children }: { children?: React.ReactNode }) => createElement(
    'pre',
    { className: 'mt-3 overflow-x-auto rounded-2xl bg-slate-950 px-4 py-3 text-[13px] leading-6 text-slate-100 shadow-inner first:mt-0' },
    children,
  ),
  code: ({ className, children }: { className?: string; children?: React.ReactNode }) => {
    if (className) {
      return createElement('code', { className }, children);
    }

    return createElement(
      'code',
      { className: 'rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.92em] text-slate-800' },
      children,
    );
  },
};

export const MarkdownMessage = ({ content, isIncomplete = false }: MarkdownMessageProps) => {
  if (!content) {
    return null;
  }

  return createElement(
    'div',
    { className: 'text-sm leading-7 text-slate-700 md:text-[15px]' },
    createElement(
      ReactMarkdown,
      {
        remarkPlugins: [remarkGfm],
        rehypePlugins: [rehypeSanitize],
        skipHtml: true,
        components: markdownComponents,
      },
      content,
    ),
    isIncomplete ? createElement('span', { className: 'ml-1 inline text-slate-400' }, '...') : null,
  );
};