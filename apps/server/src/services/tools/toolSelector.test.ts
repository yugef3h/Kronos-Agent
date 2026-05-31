import { selectToolNamesFromPrompt } from './toolSelector';

describe('selectToolNamesFromPrompt', () => {
  it('should include token estimator for token-like prompts', () => {
    const result = selectToolNamesFromPrompt('Please analyze token probabilities');
    expect(result).toContain('token_estimator');
  });

  it('should include attention probe for attention prompts', () => {
    const result = selectToolNamesFromPrompt('请帮我分析注意力热力图');
    expect(result).toContain('attention_probe');
  });

  it('should return empty array when no tool intent is detected', () => {
    const result = selectToolNamesFromPrompt('How are you today?');
    expect(result).toEqual([]);
  });
});
