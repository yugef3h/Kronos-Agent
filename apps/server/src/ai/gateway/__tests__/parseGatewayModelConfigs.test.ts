import { parseGatewayModelConfigs } from '../parseGatewayModelConfigs.js';

describe('parseGatewayModelConfigs', () => {
  it('returns empty array when raw is missing', () => {
    expect(parseGatewayModelConfigs(undefined)).toEqual([]);
  });

  it('parses valid gateway model JSON', () => {
    const raw = JSON.stringify([
      {
        id: 'doubao-chat',
        provider: 'doubao',
        model: 'ep-test',
        baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
        apiKeyEnv: 'DOUBAO_API_KEY',
        intents: ['chat'],
        priority: 10,
        maxConcurrency: 4,
        enabled: true,
      },
    ]);

    const configs = parseGatewayModelConfigs(raw);
    expect(configs).toHaveLength(1);
    expect(configs[0]?.id).toBe('doubao-chat');
  });

  it('returns empty array for invalid JSON', () => {
    expect(parseGatewayModelConfigs('not-json')).toEqual([]);
  });
});
