import { ChatPromptTemplate, FewShotChatMessagePromptTemplate } from '@langchain/core/prompts';

export type TakeoutOrchestrationFewShotExample = {
  input: string;
  output: string;
};

/** 固定 few-shot：强化四种尾标格式，勿放入真实会话 history。 */
export const TAKEOUT_ORCHESTRATION_FEW_SHOT_EXAMPLES: TakeoutOrchestrationFewShotExample[] = [
  {
    input: '今天天气怎么样',
    output: '[[DELEGATE]]',
  },
  {
    input: '想点外卖',
    output: '想吃什么？告诉我菜品我就帮你安排。\n[[ASK_SLOT]]',
  },
  {
    input: '帮我点一杯少糖生椰拿铁，送到公司',
    output: '好的，这就帮你安排。\n[[TAKEOUT_TOOL]]{"food":"少糖生椰拿铁"}',
  },
  {
    input: '中午吃什么比较好',
    output: '可以点个轻食或面，你更想吃哪种？\n[[CHAT]]',
  },
];

const takeoutOrchestrationFewShotExamplePrompt = ChatPromptTemplate.fromMessages([
  ['human', '{input}'],
  ['ai', '{output}'],
]);

export const takeoutOrchestrationFewShotPrompt = new FewShotChatMessagePromptTemplate({
  examplePrompt: takeoutOrchestrationFewShotExamplePrompt,
  examples: TAKEOUT_ORCHESTRATION_FEW_SHOT_EXAMPLES,
  inputVariables: [],
});
