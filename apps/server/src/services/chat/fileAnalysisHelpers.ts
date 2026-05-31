import {
  extractDoubaoChatReply,
  type DoubaoChatCompletionResponse,
} from './doubaoChatHelpers.js';

export type { DoubaoChatCompletionResponse } from './doubaoChatHelpers.js';

export type ParsedFilePayload = {
  mimeType: string;
  buffer: Buffer;
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
  return extractDoubaoChatReply(payload);
};