let extractImageRecognitionReply: (payload: unknown) => string;

beforeAll(async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-123456';
  process.env.DOUBAO_API_KEY = process.env.DOUBAO_API_KEY || 'test-api-key';
  process.env.DOUBAO_BASE_URL = process.env.DOUBAO_BASE_URL || 'https://example.com/v1';
  process.env.DOUBAO_MODEL = process.env.DOUBAO_MODEL || 'test-model';

  ({ extractImageRecognitionReply } = await import('./imageRecognitionService'));
});

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
