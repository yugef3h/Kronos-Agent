import {
  extractDoubaoChatReply,
  readDoubaoChatStreamReply,
} from './doubaoChatHelpers';

const createSseResponse = (chunks: string[]): Response => {
  const encoder = new TextEncoder();

  return new Response(
    new ReadableStream({
      start(controller) {
        chunks.forEach((chunk) => {
          controller.enqueue(encoder.encode(chunk));
        });
        controller.close();
      },
    }),
    {
      headers: {
        'Content-Type': 'text/event-stream',
      },
    },
  );
};

describe('doubaoChatHelpers', () => {
  it('extracts text from full chat completion payload', () => {
    expect(
      extractDoubaoChatReply({
        choices: [
          {
            message: {
              content: [
                { type: 'output_text', text: '第一句。' },
                { type: 'output_text', text: '第二句。' },
              ],
            },
          },
        ],
      }),
    ).toBe('第一句。第二句。');
  });

  it('aggregates streamed SSE chunks into a single reply', async () => {
    const response = createSseResponse([
      'data: {"choices":[{"delta":{"content":"图中有"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":" 一只猫"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"。"}}]}\n\n',
      'data: [DONE]\n\n',
    ]);

    await expect(readDoubaoChatStreamReply(response)).resolves.toBe('图中有 一只猫。');
  });

  it('handles SSE payload split across transport chunks', async () => {
    const response = createSseResponse([
      'data: {"choices":[{"delta":',
      '{"content":"这是合同"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"摘要。"}}]}\n\n',
      'data: [DONE]\n\n',
    ]);

    await expect(readDoubaoChatStreamReply(response)).resolves.toBe('这是合同摘要。');
  });

  it('throws when stream response has no body', async () => {
    const response = new Response(null);

    await expect(readDoubaoChatStreamReply(response)).rejects.toThrow(
      'Doubao stream response body is empty',
    );
  });
});