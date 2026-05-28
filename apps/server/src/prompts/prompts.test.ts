import { describe, expect, it } from '@jest/globals';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { HOT_TOPICS_TASK, hotTopicsChatPrompt } from './hotTopicsPrompt.js';
import { takeoutCatalogChatPrompt } from './takeoutCatalogPrompt.js';
import {
  buildTakeoutOrchestrationHistory,
  takeoutOrchestrationChatPrompt,
} from './takeoutOrchestrationPrompt.js';
import { ragQueryExpansionChatPrompt } from './ragQueryExpansionPrompt.js';

describe('ChatPromptTemplate (P0)', () => {
  it('formats hot topics messages', async () => {
    const messages = await hotTopicsChatPrompt.formatMessages({ task: HOT_TOPICS_TASK });
    expect(messages).toHaveLength(2);
    expect(messages[0]).toBeInstanceOf(SystemMessage);
    expect(messages[1]).toBeInstanceOf(HumanMessage);
    expect((messages[1] as HumanMessage).content).toBe(HOT_TOPICS_TASK);
  });

  it('formats takeout catalog messages', async () => {
    const messages = await takeoutCatalogChatPrompt.formatMessages({ prompt: '来杯咖啡' });
    expect(messages).toHaveLength(2);
    expect((messages[1] as HumanMessage).content).toBe('来杯咖啡');
  });

  it('formats takeout orchestration with history placeholder', async () => {
    const messages = await takeoutOrchestrationChatPrompt.formatMessages({
      history: buildTakeoutOrchestrationHistory(['上次点了面']),
      prompt: '再来一份',
    });
    expect(messages).toHaveLength(3);
    expect(messages[0]).toBeInstanceOf(SystemMessage);
    expect((messages[1] as HumanMessage).content).toBe('上下文片段：上次点了面');
    expect((messages[2] as HumanMessage).content).toBe('再来一份');
  });

  it('formats rag query expansion messages', async () => {
    const messages = await ragQueryExpansionChatPrompt.formatMessages({ userQuery: '向量检索' });
    expect(messages).toHaveLength(2);
    expect((messages[1] as HumanMessage).content).toBe('向量检索');
  });
});
