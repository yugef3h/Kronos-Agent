/** 网关路由意图，决定模型池与超时策略 */
export type ModelRouteIntent = 'chat' | 'embedding' | 'vision' | 'planning';

export const MODEL_ROUTE_INTENTS: readonly ModelRouteIntent[] = [
  'chat',
  'embedding',
  'vision',
  'planning',
] as const;

export const isModelRouteIntent = (value: string): value is ModelRouteIntent =>
  (MODEL_ROUTE_INTENTS as readonly string[]).includes(value);
