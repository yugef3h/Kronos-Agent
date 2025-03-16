import { env } from '../config/env.js';

type DoubaoContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

type DoubaoMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string | DoubaoContentPart[];
};

type DoubaoChatCompletionRequest = {
  model: string;
  messages: DoubaoMessage[];
  temperature?: number;
  max_tokens?: number;
};

type DoubaoChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
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

export const extractImageRecognitionReply = (payload: DoubaoChatCompletionResponse): string => {
  const content = payload.choices?.[0]?.message?.content;
  return normalizeResponseText(content);
};

export const recognizeImageByDoubao = async (params: {
  imageDataUrl: string;
  prompt?: string;
}): Promise<{ reply: string; model: string }> => {
  const promptText = params.prompt?.trim() || '请识别这张图片中的主要内容，并给出简洁说明。';
  const endpoint = `${env.DOUBAO_BASE_URL.replace(/\/$/, '')}/chat/completions`;

  const requestBody: DoubaoChatCompletionRequest = {
    model: env.DOUBAO_MODEL,
    temperature: 0.2,
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: promptText },
          { type: 'image_url', image_url: { url: params.imageDataUrl } },
        ],
      },
    ],
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.DOUBAO_API_KEY}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(`Doubao image recognition failed: ${response.status}`);
  }

  const payload = (await response.json()) as DoubaoChatCompletionResponse;
  const reply = extractImageRecognitionReply(payload);

  if (!reply) {
    throw new Error('Doubao image recognition returned empty reply');
  }

  return {
    reply,
    model: env.DOUBAO_MODEL,
  };
};
