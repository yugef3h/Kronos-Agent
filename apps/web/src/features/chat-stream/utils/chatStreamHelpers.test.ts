import {
  buildConversationText,
  formatUploadSize,
  getLatestUserQuestion,
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
});