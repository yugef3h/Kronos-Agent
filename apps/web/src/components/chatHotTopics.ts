export const HOT_TOPIC_PROMPTS = [
  '最近有什么新的科技资讯值得关注',
  'AI 岗位工程师需求激增，背后原因是什么',
  '最新 AI 布局会影响哪些行业',
  '大模型这半年各个大厂有哪些关键进展',
  '机器人和自动驾驶最近有哪些突破',
] as const;

export const shouldShowHotTopics = (params: {
  messageCount: number;
  prompt: string;
  hasPendingImage: boolean;
  hasPendingFile: boolean;
}): boolean => {
  return params.messageCount === 0
    && params.prompt.trim().length === 0
    && !params.hasPendingImage
    && !params.hasPendingFile;
};