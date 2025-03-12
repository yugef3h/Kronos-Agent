export const selectToolNamesFromPrompt = (prompt: string): string[] => {
  const normalizedPrompt = prompt.toLowerCase();
  const toolNames: string[] = [];

  if (
    normalizedPrompt.includes('token') ||
    normalizedPrompt.includes('采样') ||
    normalizedPrompt.includes('概率')
  ) {
    toolNames.push('token_estimator');
  }

  if (
    normalizedPrompt.includes('attention') ||
    normalizedPrompt.includes('注意力') ||
    normalizedPrompt.includes('heatmap')
  ) {
    toolNames.push('attention_probe');
  }

  return toolNames;
};
