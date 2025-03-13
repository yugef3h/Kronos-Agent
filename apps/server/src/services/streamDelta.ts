export const normalizeStreamDelta = (previousChunkText: string, currentChunkText: string): string => {
  if (!currentChunkText) {
    return '';
  }

  if (previousChunkText && currentChunkText.startsWith(previousChunkText)) {
    return currentChunkText.slice(previousChunkText.length);
  }

  return currentChunkText;
};
