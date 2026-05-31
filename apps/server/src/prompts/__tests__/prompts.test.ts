import { describe, expect, it } from '@jest/globals';
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { HOT_TOPICS_TASK, hotTopicsChatPrompt } from '../../../hotTopicsPrompt.js';
import { takeoutCatalogChatPrompt } from '../../../takeoutCatalogPrompt.js';
import {
  buildTakeoutOrchestrationHistory,
  formatTakeoutOrchestrationMessages,
} from '../../../takeoutOrchestrationPrompt.js';
import {
  TAKEOUT_ORCHESTRATION_FEW_SHOT_EXAMPLES,
  takeoutOrchestrationFewShotPrompt,
} from '../../../takeoutOrchestrationFewShots.js';
import { FewShotChatMessagePromptTemplate } from '@langchain/core/prompts';
import { ragQueryExpansionChatPrompt } from '../../../ragQueryExpansionPrompt.js';

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

  it('uses FewShotChatMessagePromptTemplate for takeout orchestration', () => {
    expect(takeoutOrchestrationFewShotPrompt).toBeInstanceOf(FewShotChatMessagePromptTemplate);
  });

  it('formats takeout orchestration with few-shot, history, and current turn', async () => {
    const messages = await formatTakeoutOrchestrationMessages({
      history: buildTakeoutOrchestrationHistory(['上次点了面']),
      prompt: '再来一份',
    });
    const fewShotMessageCount = TAKEOUT_ORCHESTRATION_FEW_SHOT_EXAMPLES.length * 2;
    expect(messages).toHaveLength(1 + fewShotMessageCount + 1 + 1);
    expect(messages[0]).toBeInstanceOf(SystemMessage);
    expect(messages[1]).toBeInstanceOf(HumanMessage);
    expect(messages[2]).toBeInstanceOf(AIMessage);
    expect((messages[2] as AIMessage).content).toContain('[[DELEGATE]]');
    const historyIndex = 1 + fewShotMessageCount;
    expect((messages[historyIndex] as HumanMessage).content).toBe('上下文片段：上次点了面');
    expect((messages[historyIndex + 1] as HumanMessage).content).toBe('再来一份');
  });

  it('formats rag query expansion messages', async () => {
    const messages = await ragQueryExpansionChatPrompt.formatMessages({ userQuery: '向量检索' });
    expect(messages).toHaveLength(2);
    expect((messages[1] as HumanMessage).content).toBe('向量检索');
  });
});
