import { extractDoubaoChatReply } from '../../chat/doubaoChatHelpers.js';

const extractImageRecognitionReply = extractDoubaoChatReply as (payload: unknown) => string;

describe('extractImageRecognitionReply', () => {
  it('reads string response', () => {
    const reply = extractImageRecognitionReply({
      choices: [
        {
          message: {
            content: '这是一份沙拉。',
          },
        },
      ],
    });

    expect(reply).toBe('这是一份沙拉。');
  });

  it('reads array response', () => {
    const reply = extractImageRecognitionReply({
      choices: [
        {
          message: {
            content: [
              { type: 'output_text', text: '图中有一只猫。' },
              { type: 'output_text', text: '背景是沙发。' },
            ],
          },
        },
      ],
    });

    expect(reply).toBe('图中有一只猫。背景是沙发。');
  });

  it('returns empty text when payload is invalid', () => {
    const reply = extractImageRecognitionReply({});
    expect(reply).toBe('');
  });
});
