export type DoubaoChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
};

export type ParsedFilePayload = {
  mimeType: string;
  buffer: Buffer;
};

const normalizeResponseText = (content: unknown): string => {
  if (typeof content === 'string') {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') {
          return part;
        }

        if (typeof part === 'object' && part !== null) {
          const text = (part as { text?: unknown }).text;
          return typeof text === 'string' ? text : '';
        }

        return '';
      })
      .join('')
      .trim();
  }

  return '';
};

export const getFileExtension = (fileName: string): string => {
  const segments = fileName.toLowerCase().split('.');
  return segments.length > 1 ? segments[segments.length - 1] : '';
};

export const parseFileDataUrl = (fileDataUrl: string): ParsedFilePayload => {
  const match = /^data:([^;,]+);base64,([\s\S]+)$/.exec(fileDataUrl);

  if (!match) {
    throw new Error('Invalid file data payload');
  }

  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], 'base64'),
  };
};

export const normalizeExtractedText = (text: string): string => {
  return text
    .replace(/\0/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

export const extractFileAnalysisReply = (payload: DoubaoChatCompletionResponse): string => {
  const content = payload.choices?.[0]?.message?.content;
  return normalizeResponseText(content);
};