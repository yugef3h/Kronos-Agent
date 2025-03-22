import { HOT_TOPIC_PROMPTS, shouldShowHotTopics } from './chatHotTopics';

describe('chatHotTopics', () => {
  it('exposes five hot topic prompts', () => {
    expect(HOT_TOPIC_PROMPTS).toHaveLength(5);
    expect(HOT_TOPIC_PROMPTS).toContain('最近有什么新鲜的科技资讯值得关注');
    expect(HOT_TOPIC_PROMPTS).toContain('AI 岗位工程师需求激增，背后原因是什么');
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