import type { GatewayModelConfig } from '../types/gatewayModelConfig.js';
import { selectGatewayModel } from './selectGatewayModel.js';

const baseConfig = (overrides: Partial<GatewayModelConfig>): GatewayModelConfig => ({
  id: 'a',
  provider: 'doubao',
  model: 'm',
  baseUrl: 'https://example.com/v1',
  apiKeyEnv: 'DOUBAO_API_KEY',
  intents: ['chat'],
  priority: 0,
  maxConcurrency: 8,
  enabled: true,
  ...overrides,
});

describe('selectGatewayModel', () => {
  it('picks highest priority model for intent', () => {
    const selected = selectGatewayModel(
      { userId: 'u1', intent: 'chat', traceId: 't1' },
      [
        baseConfig({ id: 'low', priority: 1 }),
        baseConfig({ id: 'high', priority: 9 }),
      ],
    );

    expect(selected?.id).toBe('high');
  });

  it('returns null when no enabled model matches intent', () => {
    const selected = selectGatewayModel(
      { userId: 'u1', intent: 'vision', traceId: 't1' },
      [baseConfig({ intents: ['chat'], enabled: false })],
    );

    expect(selected).toBeNull();
  });
});
