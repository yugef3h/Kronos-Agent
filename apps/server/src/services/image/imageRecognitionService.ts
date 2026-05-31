import { getActiveModelCredentials } from '../../ai/gateway/resolveDefaultGatewayModel.js';
import {
  extractDoubaoChatReply,
  readDoubaoChatStreamReply,
} from './doubaoChatHelpers.js';

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
  stream?: boolean;
};

export const extractImageRecognitionReply = extractDoubaoChatReply;

// https://www.volcengine.com/docs/82379/1494384?redirect=1&lang=zh
export const recognizeImageByDoubao = async (params: {
  imageDataUrl: string;
  prompt?: string;
}): Promise<{ reply: string; model: string }> => {
  const creds = getActiveModelCredentials();
  const promptText = params.prompt?.trim() || '请识别这张图片中的主要内容，并给出简洁说明。';
  const endpoint = `${creds.baseUrl.replace(/\/$/, '')}/chat/completions`;

  const requestBody: DoubaoChatCompletionRequest = {
    model: creds.model,
    temperature: 0.2,
    max_tokens: 512,
    stream: true,
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
      Accept: 'text/event-stream',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${creds.apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(`Image recognition failed (${response.status})`);
  }

  const reply = await readDoubaoChatStreamReply(response);

  if (!reply) {
    throw new Error('Image recognition returned empty reply');
  }

  return {
    reply,
    model: creds.model,
  };
};
