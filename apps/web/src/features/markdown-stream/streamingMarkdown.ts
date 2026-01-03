export type StreamingMarkdownSegment =
  | { type: 'prose'; content: string }
  | { type: 'code'; language: string; content: string; isOpen: boolean };

const FENCED_CODE_BLOCK_RE = /```([\w-]*)\n?([\s\S]*?)(?:```|$)/g;

const CODE_LIKE_LINE_RE = /^\s*(import |export |const |let |var |function |class |interface |type |def |async |await |#include |package |public |private |<\?php|SELECT |INSERT |UPDATE |DELETE )/m;

/** 流式阶段补全未闭合的围栏，便于 markdown 解析器实时渲染代码块 */
export const closeOpenMarkdownFence = (content: string): string => {
  const fenceCount = (content.match(/```/g) ?? []).length;
  if (fenceCount % 2 === 0) {
    return content;
  }

  return `${content}\n\`\`\``;
};

export const isInsideOpenCodeFence = (content: string): boolean => {
  const fenceCount = (content.match(/```/g) ?? []).length;
  return fenceCount % 2 === 1;
};

export const extractOpenFenceLanguage = (content: string): string => {
  const lastFenceIndex = content.lastIndexOf('```');
  if (lastFenceIndex < 0) {
    return '';
  }

  const header = content.slice(lastFenceIndex, content.indexOf('\n', lastFenceIndex) + 1);
  const language = header.slice(3).trim().split(/\s/)[0] ?? '';
  return language.replace(/[^a-zA-Z0-9+#-]/g, '');
};

export const looksLikeCodeStream = (content: string): boolean => {
  if (isInsideOpenCodeFence(content)) {
    return true;
  }

  const trimmed = content.trim();
  if (!trimmed) {
    return false;
  }

  if (trimmed.startsWith('```')) {
    return true;
  }

  return CODE_LIKE_LINE_RE.test(trimmed);
};

/** 无围栏但明显是代码时，包一层虚拟围栏，保证流式阶段也走代码块渲染 */
export const wrapBareCodeStream = (content: string): string => {
  if (isInsideOpenCodeFence(content) || content.includes('```')) {
    return content;
  }

  if (!looksLikeCodeStream(content)) {
    return content;
  }

  const language = inferCodeLanguage(content);
  return `\`\`\`${language}\n${content}`;
};

export const inferCodeLanguage = (content: string): string => {
  const openLanguage = extractOpenFenceLanguage(content);
  if (openLanguage) {
    return openLanguage;
  }

  const sample = content.trim().slice(0, 400);
  if (
    (/\b(import|export)\b/.test(sample) && /from ['"]/.test(sample)) ||
    /^\s*export\s+(const|let|var|function|class|type|interface|enum|default)\b/m.test(sample)
  ) {
    return 'typescript';
  }
  if (/^\s*def \w+\(/m.test(sample) || /:\s*$/m.test(sample)) {
    return 'python';
  }
  if (/^\s*<\?xml/m.test(sample) || /<\w+[^>]*>/.test(sample)) {
    return 'xml';
  }
  if (/^\s*\{[\s\S]*"[\w-]+"\s*:/m.test(sample)) {
    return 'json';
  }
  if (/^\s*#include\s+</m.test(sample)) {
    return 'cpp';
  }
  if (/^\s*package\s+\w+/m.test(sample)) {
    return 'java';
  }
  if (/^\s*func\s+\w+/m.test(sample)) {
    return 'go';
  }

  return 'plaintext';
};

export const prepareStreamingMarkdown = (content: string, isStreaming: boolean): string => {
  if (!content) {
    return content;
  }

  let prepared = content;
  if (isStreaming) {
    prepared = wrapBareCodeStream(prepared);
    prepared = closeOpenMarkdownFence(prepared);
  }

  return prepared;
};

export const splitStreamingMarkdownSegments = (content: string): StreamingMarkdownSegment[] => {
  const segments: StreamingMarkdownSegment[] = [];
  let lastIndex = 0;

  for (const match of content.matchAll(FENCED_CODE_BLOCK_RE)) {
    const matchIndex = match.index ?? 0;
    const prose = content.slice(lastIndex, matchIndex);
    if (prose.trim()) {
      segments.push({ type: 'prose', content: prose });
    }

    segments.push({
      type: 'code',
      language: match[1] ?? '',
      content: match[2] ?? '',
      isOpen: !match[0].endsWith('```'),
    });

    lastIndex = matchIndex + match[0].length;
  }

  const tail = content.slice(lastIndex);
  if (tail.trim()) {
    segments.push({ type: 'prose', content: tail });
  }

  return segments;
};
