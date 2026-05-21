export type WeightedRetrievalScore = {
  id: string;
  score: number;
};

export type RetrievalPathWeights = {
  semantic: number;
  keyword: number;
  fullText: number;
};

/** 多路分数加权融合 */
export const mergeRetrievalPaths = (
  semantic: WeightedRetrievalScore[],
  keyword: WeightedRetrievalScore[],
  fullText: WeightedRetrievalScore[],
  weights: RetrievalPathWeights,
): WeightedRetrievalScore[] => {
  const merged = new Map<string, number>();
  const totalWeight = Math.max(weights.semantic + weights.keyword + weights.fullText, 0.0001);

  const apply = (items: WeightedRetrievalScore[], weight: number) => {
    for (const item of items) {
      const current = merged.get(item.id) ?? 0;
      merged.set(item.id, current + item.score * weight);
    }
  };

  apply(semantic, weights.semantic);
  apply(keyword, weights.keyword);
  apply(fullText, weights.fullText);

  return [...merged.entries()]
    .map(([id, score]) => ({ id, score: score / totalWeight }))
    .sort((left, right) => right.score - left.score);
};
