import { deriveCatalogDiscount, generateTakeoutCatalog } from './takeoutCatalogService';

describe('takeoutCatalogService', () => {
  const previousEnv = {
    apiKey: process.env.DOUBAO_API_KEY,
    baseURL: process.env.DOUBAO_BASE_URL,
    model: process.env.DOUBAO_MODEL,
  };

  beforeEach(() => {
    delete process.env.DOUBAO_API_KEY;
    delete process.env.DOUBAO_BASE_URL;
    delete process.env.DOUBAO_MODEL;
  });

  afterAll(() => {
    process.env.DOUBAO_API_KEY = previousEnv.apiKey;
    process.env.DOUBAO_BASE_URL = previousEnv.baseURL;
    process.env.DOUBAO_MODEL = previousEnv.model;
  });

  it('returns a fallback catalog with stable food cards', async () => {
    const result = await generateTakeoutCatalog({
      prompt: '中午想吃面，最好二十多块钱',
      address: '上海市浦东新区博云路2号',
    });

    expect(result.source).toBe('fallback');
    expect(result.address).toBe('上海市浦东新区博云路2号');
    expect(result.foods).toHaveLength(3);
    expect(result.foods.every((food) => food.shopName.length > 0)).toBe(true);
    expect(result.foods.every((food) => food.combos.length > 0)).toBe(true);

    const prices = result.foods.map((food) => food.price);
    const priceGap = Math.max(...prices) - Math.min(...prices);
    expect(priceGap).toBeLessThanOrEqual(8);
  });

  it('picks beverage candidates for coffee prompts', async () => {
    const result = await generateTakeoutCatalog({
      prompt: '下午来杯咖啡，想喝拿铁',
    });

    expect(result.foods).toHaveLength(3);
    expect(result.foods.some((food) => /拿铁|咖啡/.test(food.productName))).toBe(true);
    expect(result.delivery.eta).toContain('预计');
  });

  it('derives a reasonable discount from candidate prices', () => {
    expect(deriveCatalogDiscount([22, 24, 25])).toBe(5.5);
    expect(deriveCatalogDiscount([28, 30, 32])).toBe(6.6);
    expect(deriveCatalogDiscount([])).toBe(6.4);
  });
});