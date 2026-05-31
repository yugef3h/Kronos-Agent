import { getTermCandidates, normalizeText } from '../../services/knowledge/knowledgeRetrievalService.js';

/** 关键词路打分 */
export const scoreKeywordPath = (query: string, text: string): number => {
  const terms = getTermCandidates(query);
  if (!terms.length) {
    return 0;
  }

  const normalized = normalizeText(text);
  const hits = terms.filter((term) => normalized.includes(term)).length;
  return hits / terms.length;
};
