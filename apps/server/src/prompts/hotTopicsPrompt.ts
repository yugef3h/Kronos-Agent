import { SystemMessage } from '@langchain/core/messages';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { HOT_TOPICS_PROMPT } from '../const/prompt.js';

export const HOT_TOPICS_TASK = '生成今日热门提问';

export const hotTopicsChatPrompt = ChatPromptTemplate.fromMessages([
  new SystemMessage(HOT_TOPICS_PROMPT),
  ['human', '{task}'],
]);
