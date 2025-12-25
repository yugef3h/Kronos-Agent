import * as React from 'react';
import { StreamingMarkdownMessage } from '../features/markdown-stream/StreamingMarkdownMessage';

type MarkdownMessageProps = {
  content: string;
  isIncomplete?: boolean;
};

export const MarkdownMessage = ({ content, isIncomplete = false }: MarkdownMessageProps) => {
  return React.createElement(StreamingMarkdownMessage, {
    content,
    isIncomplete,
    isStreaming: false,
  });
};
