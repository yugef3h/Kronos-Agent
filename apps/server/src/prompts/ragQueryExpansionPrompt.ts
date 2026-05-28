import { SystemMessage } from '@langchain/core/messages';
import { ChatPromptTemplate } from '@langchain/core/prompts';

export const RAG_QUERY_EXPANSION_SYSTEM_PROMPT =
  'You rewrite user search queries for knowledge-base retrieval. Reply with JSON only, no markdown: '
  + '{"queries":["...","..."]}. Include 2 to 4 short alternative phrasings (same language as the user). '
  + 'Do not add keys other than "queries".';

export const ragQueryExpansionChatPrompt = ChatPromptTemplate.fromMessages([
  new SystemMessage(RAG_QUERY_EXPANSION_SYSTEM_PROMPT),
  ['human', '{userQuery}'],
]);
