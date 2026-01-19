import { HumanMessage } from '@langchain/core/messages';

const isImageUrl = (value: string) => {
  const trimmed = value.trim();
  return trimmed.startsWith('data:image/') || /^https?:\/\//i.test(trimmed);
};

/** 当前轮用户消息：纯文本或多模态（文本 + data URL / HTTPS 图片） */
export const buildUserHumanMessage = (prompt: string, imageDataUrls?: string[]): HumanMessage => {
  const urls = (imageDataUrls ?? []).map((u) => u.trim()).filter(isImageUrl);
  if (urls.length === 0) {
    return new HumanMessage(prompt);
  }

  const content: Array<
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } }
  > = [{ type: 'text', text: prompt }, ...urls.map((url) => ({ type: 'image_url' as const, image_url: { url } }))];

  return new HumanMessage({ content });
};
