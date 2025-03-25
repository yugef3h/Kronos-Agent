import { HOT_TOPIC_PROMPTS, shouldShowHotTopics } from './chatHotTopics';

describe('chatHotTopics', () => {
  it('exposes five hot topic prompts', () => {
    expect(HOT_TOPIC_PROMPTS).toHaveLength(5);
    expect(HOT_TOPIC_PROMPTS.some((topic) => topic.includes('科技资讯'))).toBe(true);
    expect(HOT_TOPIC_PROMPTS.some((topic) => topic.includes('AI'))).toBe(true);
  });

  it('shows hot topics only for a blank initial composer state', () => {
    expect(shouldShowHotTopics({
      messageCount: 0,
      prompt: '',
      hasPendingImage: false,
      hasPendingFile: false,
    })).toBe(true);

    expect(shouldShowHotTopics({
      messageCount: 1,
      prompt: '',
      hasPendingImage: false,
      hasPendingFile: false,
    })).toBe(false);

    expect(shouldShowHotTopics({
      messageCount: 0,
      prompt: 'hello',
      hasPendingImage: false,
      hasPendingFile: false,
    })).toBe(false);

    expect(shouldShowHotTopics({
      messageCount: 0,
      prompt: '',
      hasPendingImage: true,
      hasPendingFile: false,
    })).toBe(false);
  });
});