import type { GatewayRequestContext } from '../types/gatewayRequestContext.js';
import type { ModelRouteRule } from '../types/modelRouteRule.js';
import { selectFallbackModel } from '../circuit/selectFallbackModel.js';
import { buildOpenAiCompatibleClient } from './buildOpenAiCompatibleClient.js';
import { filterConfigsByTier } from './filterConfigsByTier.js';
import { parseGatewayModelConfigs } from './parseGatewayModelConfigs.js';
import { pickModelTierByTokens } from './pickModelTierByTokens.js';
import { resolveDefaultGatewayModel } from './resolveDefaultGatewayModel.js';
import { selectGatewayModel } from './selectGatewayModel.js';

export type GatewayChatModelOptions = {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  timeoutMs?: number;
  promptTokens?: number;
};

const DEFAULT_TIER_RULES: ModelRouteRule[] = [
  { intent: 'chat', tier: 'small', maxPromptTokens: 500 },
  { intent: 'chat', tier: 'large', maxPromptTokens: 4000 },
];

const isTierRoutingEnabled = (): boolean =>
  (process.env.AI_MODEL_TIER_ROUTING ?? 'false').trim().toLowerCase() === 'true';

/** 共用：解析网关模型并构造 ChatOpenAI */
export const resolveGatewayChatModel = (
  ctx: GatewayRequestContext,
  options: GatewayChatModelOptions = {},
) => {
  let configs = parseGatewayModelConfigs(process.env.AI_GATEWAY_MODELS);

  if (isTierRoutingEnabled() && typeof options.promptTokens === 'number') {
    const tier = pickModelTierByTokens(options.promptTokens, DEFAULT_TIER_RULES);
    const tierFiltered = filterConfigsByTier(configs, tier);
    if (tierFiltered.length > 0) {
      configs = tierFiltered;
    }
  }

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
