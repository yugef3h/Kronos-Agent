import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import { createMarkdownComponents } from './markdownComponents';
import { markdownSanitizeSchema } from './markdownSanitizeSchema';
import { prepareStreamingMarkdown } from './streamingMarkdown';

const createElement = React.createElement;

export type StreamingMarkdownMessageProps = {
  content: string;
  isIncomplete?: boolean;
  isStreaming?: boolean;
};

export const StreamingMarkdownMessage = ({
  content,
  isIncomplete = false,
  isStreaming = false,
}: StreamingMarkdownMessageProps) => {
  const preparedContent = prepareStreamingMarkdown(content, isStreaming || isIncomplete);
  const components = React.useMemo(
    () => createMarkdownComponents({
      isStreaming: isStreaming || isIncomplete,
      rawContent: content,
    }),
    [content, isIncomplete, isStreaming],
  );

  if (!content) {
    return null;
  }

  return createElement(
    'div',
    { className: 'text-sm leading-7 text-slate-700 md:text-[15px]' },
    createElement(ReactMarkdown, {
      remarkPlugins: [remarkGfm],
      rehypePlugins: [[rehypeSanitize, markdownSanitizeSchema]],
      skipHtml: true,
      components,
      children: preparedContent,
    }),
    isIncomplete && !isStreaming
      ? createElement('span', { className: 'ml-1 inline text-slate-400' }, '...')
      : null,
  );
};
