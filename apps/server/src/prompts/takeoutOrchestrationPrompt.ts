import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { TAKEOUT_ORCHESTRATION_PROMPT } from '../const/prompt.js';

export const takeoutOrchestrationChatPrompt = ChatPromptTemplate.fromMessages([
  new SystemMessage(TAKEOUT_ORCHESTRATION_PROMPT),
  new MessagesPlaceholder('history'),
  ['human', '{prompt}'],
]);

export const buildTakeoutOrchestrationHistory = (history: string[]) =>
  history.map((item) => new HumanMessage(`上下文片段：${item}`));
