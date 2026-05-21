/** G-01: 统一网关支持的模型供应商标识 */
export type ModelProviderId =
  | 'doubao'
  | 'openai'
  | 'qwen'
  | 'wenxin'
  | 'spark'
  | 'local';

export const MODEL_PROVIDER_IDS: readonly ModelProviderId[] = [
  'doubao',
  'openai',
  'qwen',
  'wenxin',
  'spark',
  'local',
] as const;

export const isModelProviderId = (value: string): value is ModelProviderId =>
  (MODEL_PROVIDER_IDS as readonly string[]).includes(value);
