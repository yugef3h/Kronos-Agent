import { describe, expect, it } from '@jest/globals';
import { AIMessage, HumanMessage } from '@langchain/core/messages';
import { findCurrentTurnAssistantText, findLatestAssistantText } from './toolStreamMapper';

describe('findCurrentTurnAssistantText', () => {
  it('returns only assistant text after the last human message', () => {
    const messages = [
      new HumanMessage('上一轮问题'),
      new AIMessage('上一轮旧回答'),
      new HumanMessage('今天是几号'),
      new AIMessage('今天是 5 月 17 日'),
    ];

    expect(findLatestAssistantText(messages)).toBe('今天是 5 月 17 日');
    expect(findCurrentTurnAssistantText(messages)).toBe('今天是 5 月 17 日');
  });

  it('ignores assistant messages before the latest human', () => {
    const messages = [
      new HumanMessage('第一问'),
      new AIMessage('第一答'),
      new HumanMessage('第二问'),
    ];

    expect(findCurrentTurnAssistantText(messages)).toBe('');
  });
});
