import { SystemMessage } from '@langchain/core/messages';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { TAKEOUT_CATALOG_PROMPT } from '../core/const/prompt.js';

export const takeoutCatalogChatPrompt = ChatPromptTemplate.fromMessages([
  new SystemMessage(TAKEOUT_CATALOG_PROMPT),
  ['human', '{prompt}'],
]);
