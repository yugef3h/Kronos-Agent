/** F-10: 统一兜底文案 */
const FALLBACK_MESSAGES: Record<string, string> = {
  model_timeout: '模型响应超时，请稍后重试或缩短问题长度。',
  model_unavailable: '模型服务暂时不可用，已切换备用策略，请稍后再试。',
  rate_limited: '请求过于频繁，请稍后再试。',
  circuit_open: '当前模型通道繁忙，系统正在自动恢复，请稍后重试。',
  default: '服务暂时不可用，请稍后重试。',
};

export const fallbackReplyText = (code: string): string =>
  FALLBACK_MESSAGES[code] ?? FALLBACK_MESSAGES.default;
