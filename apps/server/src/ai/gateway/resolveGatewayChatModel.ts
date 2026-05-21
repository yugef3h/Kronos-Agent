import type { GatewayRequestContext } from '../types/gatewayRequestContext.js';
import { buildOpenAiCompatibleClient } from './buildOpenAiCompatibleClient.js';
import { parseGatewayModelConfigs } from './parseGatewayModelConfigs.js';
import { resolveDefaultGatewayModel } from './resolveDefaultGatewayModel.js';
import { selectFallbackModel } from '../circuit/selectFallbackModel.js';
import { selectGatewayModel } from './selectGatewayModel.js';

export type GatewayChatModelOptions = {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  timeoutMs?: number;
};

/** G-11/G-12 共用：解析网关模型并构造 ChatOpenAI */
export const resolveGatewayChatModel = (
  ctx: GatewayRequestContext,
  options: GatewayChatModelOptions = {},
) => {
  const configs = parseGatewayModelConfigs(process.env.AI_GATEWAY_MODELS);
  const primary = selectGatewayModel(ctx, configs);
  const selected = selectFallbackModel(ctx, configs, primary)
    ?? primary
    ?? resolveDefaultGatewayModel(ctx.intent);

  const model = buildOpenAiCompatibleClient(selected, {
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    timeoutMs: options.timeoutMs,
  });

  if (typeof options.topP === 'number') {
    model.topP = options.topP;
  }

  return model;
};
