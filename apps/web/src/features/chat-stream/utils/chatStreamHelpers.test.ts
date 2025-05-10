import {
  buildConversationText,
  formatUploadSize,
  getPrimaryImageAttachment,
  getRenderableImageName,
  getRenderableImageSource,
  getLatestUserQuestion,
  hydrateRenderableMessages,
  markLastAssistantMessageIncomplete,
} from './chatStreamHelpers';

describe('chatStreamHelpers', () => {
  it('formats upload sizes in kb and mb', () => {
    expect(formatUploadSize(1024)).toBe('1.0 KB');
    expect(formatUploadSize(1024 * 1024)).toBe('1.0 MB');
  });

  it('finds the latest non-empty user question', () => {
    expect(getLatestUserQuestion([
      { role: 'user', content: '' },
      { role: 'assistant', content: 'hello' },
      { role: 'user', content: '最新问题' },
    ])).toBe('最新问题');
  });

  it('builds conversation text and marks the last assistant message incomplete', () => {
    const messages = [
      { role: 'user' as const, content: '你好' },
      { role: 'assistant' as const, content: '世界', isIncomplete: false },
    ];

    expect(buildConversationText(messages)).toBe('user: 你好\nassistant: 世界');
    expect(markLastAssistantMessageIncomplete(messages)[1]?.isIncomplete).toBe(true);
  });

  it('resolves image attachments from persisted session messages', () => {
    const message = {
      role: 'user' as const,
      content: '解释图片',
      attachments: [
        {
          id: 'attachment-1',
          type: 'image' as const,
          fileName: 'diagram.png',
          mimeType: 'image/png',
          size: 1024,
          createdAt: 1,
        },
      ],
    };

    expect(getPrimaryImageAttachment(message)?.id).toBe('attachment-1');
    expect(getRenderableImageSource(message)).toBe('http://localhost:3001/api/attachments/attachment-1');
    expect(getRenderableImageName(message)).toBe('diagram.png');
  });

  it('prefers in-memory preview metadata over persisted attachment data', () => {
    const message = {
      role: 'user' as const,
      content: '',
      imagePreviewUrl: 'data:image/png;base64,abc',
      imageName: 'clipboard.png',
      attachments: [
        {
          id: 'attachment-2',
          type: 'image' as const,
          fileName: 'server.png',
          mimeType: 'image/png',
          size: 2048,
          createdAt: 2,
        },
      ],
    };

    expect(getRenderableImageSource(message)).toBe('data:image/png;base64,abc');
    expect(getRenderableImageName(message)).toBe('clipboard.png');
  });

  it('splits legacy restored image messages into separate image and text bubbles', () => {
    const messages = hydrateRenderableMessages([
      {
        role: 'user' as const,
        content: '解释图片',
        attachments: [
          {
            id: 'attachment-legacy',
            type: 'image' as const,
            fileName: 'meal.png',
            mimeType: 'image/png',
            size: 512,
            createdAt: 3,
          },
        ],
      },
    ]);

    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({
      role: 'user',
      content: '',
      imageName: 'meal.png',
      imagePreviewUrl: 'http://localhost:3001/api/attachments/attachment-legacy',
    });
    expect(messages[1]).toMatchObject({
      role: 'user',
      content: '解释图片',
    });
    expect(messages[1]?.attachments).toBeUndefined();
  });
});