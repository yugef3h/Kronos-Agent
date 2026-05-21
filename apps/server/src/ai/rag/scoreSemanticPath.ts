/** R-05: 语义路打分（向量或 bigram 占位） */
export const scoreSemanticPath = (
  query: string,
  text: string,
  semanticOverride?: number | null,
): number => {
  if (semanticOverride != null && Number.isFinite(semanticOverride)) {
    return Math.max(0, Math.min(1, semanticOverride));
  }

  const compactQuery = query.trim().toLowerCase();
  const compactText = text.trim().toLowerCase();
  if (!compactQuery || !compactText) {
    return 0;
  }

  return compactText.includes(compactQuery) ? 0.85 : 0.2;
};
