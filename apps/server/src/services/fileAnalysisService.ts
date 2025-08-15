import { env } from '../config/env.js';
import {
  normalizeExtractedText,
  parseFileDataUrl,
} from './fileAnalysisHelpers.js';
import { extractDocumentText } from './documentTextExtractor.js';
import { readDoubaoChatStreamReply } from './doubaoChatHelpers.js';

const FILE_TEXT_PREVIEW_LIMIT = 16_000;
const FILE_REPLY_MAX_TOKENS = 1_200;

type DoubaoMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

type DoubaoChatCompletionRequest = {
  model: string;
  messages: DoubaoMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
};

const truncateExtractedText = (text: string): string => {
  if (text.length <= FILE_TEXT_PREVIEW_LIMIT) {
    return text;
  }

  return `${text.slice(0, FILE_TEXT_PREVIEW_LIMIT)}\n\n[已截断，原文较长]`;
};

const extractTextFromFile = async (params: {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
}): Promise<string> => {
  return normalizeExtractedText(await extractDocumentText(params));
};

const buildFileAnalysisPrompt = (params: {
  fileName: string;
  prompt?: string;
  extractedText: string;
}): string => {
  const task = params.prompt?.trim() || '请先概括文件内容，再提炼重点、风险和下一步建议。';

  return [
    `你是一名擅长阅读文档的助手。请基于以下文件内容完成任务。`,
    `文件名：${params.fileName}`,
    `任务：${task}`,
    '输出要求：',
    '1. 先给出简洁结论。',
    '2. 再列出关键信息、风险点或待确认项。',
    '3. 如果文件内容不完整或疑似解析缺失，要明确说明。',
    '文件内容如下：',
    params.extractedText,
  ].join('\n');
};

export const analyzeFileByDoubao = async (params: {
  fileDataUrl: string;
  fileName: string;
  mimeType?: string;
  prompt?: string;
}): Promise<{ reply: string; model: string; extractedCharacters: number }> => {
  const parsedPayload = parseFileDataUrl(params.fileDataUrl);
  const mimeType = params.mimeType?.trim() || parsedPayload.mimeType;
  const extractedText = await extractTextFromFile({
    buffer: parsedPayload.buffer,
    mimeType,
    fileName: params.fileName,
  });

  if (!extractedText) {
    throw new Error('文件内容为空或暂无法提取文本');
  }

  const trimmedText = truncateExtractedText(extractedText);
  const endpoint = `${env.DOUBAO_BASE_URL.replace(/\/$/, '')}/chat/completions`;
  const requestBody: DoubaoChatCompletionRequest = {
    model: env.DOUBAO_MODEL,
    temperature: 0.2,
    max_tokens: FILE_REPLY_MAX_TOKENS,
    stream: true,
    messages: [
      {
        role: 'user',
        content: buildFileAnalysisPrompt({
          fileName: params.fileName,
          prompt: params.prompt,
          extractedText: trimmedText,
        }),
      },
    ],
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Accept: 'text/event-stream',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.DOUBAO_API_KEY}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(`Doubao file analysis failed: ${response.status}`);
  }

  const reply = await readDoubaoChatStreamReply(response);

  if (!reply) {
    throw new Error('Doubao file analysis returned empty reply');
  }

  return {
    reply,
    model: env.DOUBAO_MODEL,
    extractedCharacters: extractedText.length,
  };
};