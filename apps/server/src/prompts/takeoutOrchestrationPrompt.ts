import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { TAKEOUT_ORCHESTRATION_PROMPT } from '../const/prompt.js';
import { takeoutOrchestrationFewShotPrompt } from './takeoutOrchestrationFewShots.js';

export const takeoutOrchestrationChatPrompt = ChatPromptTemplate.fromMessages([
  new SystemMessage(TAKEOUT_ORCHESTRATION_PROMPT),
  new MessagesPlaceholder('few_shot'),
  new MessagesPlaceholder('history'),
  ['human', '{prompt}'],
]);

export const buildTakeoutOrchestrationHistory = (history: string[]) =>
  history.map((item) => new HumanMessage(`上下文片段：${item}`));

/** 先 format FewShot，再注入主 ChatPrompt（规避 fromMessages 对 FewShot 的类型限制）。 */
export const formatTakeoutOrchestrationMessages = async (params: {
  history: HumanMessage[];
  prompt: string;
}) => {
  const fewShot = await takeoutOrchestrationFewShotPrompt.formatMessages({});

  return takeoutOrchestrationChatPrompt.formatMessages({
    few_shot: fewShot,
    history: params.history,
    prompt: params.prompt,
  });
};
