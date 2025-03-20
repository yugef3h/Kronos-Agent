export type DoubaoTextContentPart = {
  type?: string;
  text?: string;
};

export type DoubaoChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | DoubaoTextContentPart[];
    };
  }>;
};

type DoubaoChatCompletionChunk = {
  choices?: Array<{
    delta?: {
      content?: string | DoubaoTextContentPart[];
    };
    message?: {
      content?: string | DoubaoTextContentPart[];
    };
  }>;
};

const normalizeDoubaoResponseText = (content: unknown, shouldTrim: boolean): string => {
  if (typeof content === 'string') {
    return shouldTrim ? content.trim() : content;
  }

  if (Array.isArray(content)) {
    const text = content
      .map((part) => {
        if (typeof part === 'string') {
          return part;
        }

        if (typeof part === 'object' && part !== null) {
          const value = (part as { text?: unknown }).text;
          return typeof value === 'string' ? value : '';
        }

        return '';
      })
      .join('');

    return shouldTrim ? text.trim() : text;
  }

  return '';
};

const extractChunkText = (payload: DoubaoChatCompletionChunk): string => {
  const choice = payload.choices?.[0];
  const content = choice?.delta?.content ?? choice?.message?.content;
  return normalizeDoubaoResponseText(content, false);
};

const readSseEventData = (eventBlock: string): string => {
  const data = eventBlock
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n')
    .trim();

  if (!data || data === '[DONE]') {
    return '';
  }

  try {
    return extractChunkText(JSON.parse(data) as DoubaoChatCompletionChunk);
  } catch {
    return '';
  }
};

export const extractDoubaoChatReply = (payload: DoubaoChatCompletionResponse): string => {
  const content = payload.choices?.[0]?.message?.content;
  return normalizeDoubaoResponseText(content, true);
};

// Ark Chat API supports stream=true and returns SSE frames ending with data: [DONE].
// Official doc: https://www.volcengine.com/docs/82379/1494384?redirect=1&lang=zh
export const readDoubaoChatStreamReply = async (response: Response): Promise<string> => {
  if (!response.body) {
    throw new Error('Doubao stream response body is empty');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let reply = '';

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');

    let delimiterIndex = buffer.indexOf('\n\n');
    while (delimiterIndex >= 0) {
      const eventBlock = buffer.slice(0, delimiterIndex);
      buffer = buffer.slice(delimiterIndex + 2);
      reply += readSseEventData(eventBlock);
      delimiterIndex = buffer.indexOf('\n\n');
    }
  }

  buffer += decoder.decode();

  if (buffer.trim()) {
    reply += readSseEventData(buffer);
  }

  return reply.trim();
};