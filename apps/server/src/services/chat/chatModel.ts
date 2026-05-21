import { resolveGatewayChatModel } from '../../ai/gateway/resolveGatewayChatModel.js';

/** G-11: Playground 默认经 AI 网关解析豆包/多模型配置 */
export const chatModel = resolveGatewayChatModel(
  {
    userId: 'playground',
    intent: 'chat',
    traceId: 'playground-default',
  },
  { temperature: 0.5 },
);
