export type BatchPromptItem = {
  id: string;
  prompt: string;
};

/** M-06: 短请求合并为单条 batch prompt（占位实现） */
export const mergeBatchPrompts = (items: BatchPromptItem[], maxChars: number): string => {
  const header = 'Answer each item with a section titled [id].\n\n';
  let merged = header;

  for (const item of items) {
    const block = `[${item.id}]\n${item.prompt.trim()}\n\n`;
    if (merged.length + block.length > maxChars) {
      break;
    }
    merged += block;
  }

  return merged.trim();
};
