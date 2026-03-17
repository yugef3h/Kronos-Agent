import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';
import { analyzeTakeoutIntent } from './takeoutIntentService.js';

export type TakeoutCatalogCombo = {
  id: string;
  name: string;
  extraPrice: number;
};

export type TakeoutCatalogFood = {
  id: string;
  shopName: string;
  shopScore: number;
  distance: string;
  productName: string;
  productTip: string;
  productImage: string;
  priceTip: string;
  name: string;
  price: number;
  deliveryTime: string;
  combos: TakeoutCatalogCombo[];
};

export type TakeoutCatalogDelivery = {
  eta: string;
  courier: string;
};

export type TakeoutCatalogResult = {
  source: 'model' | 'fallback';
  address: string;
  discount: number;
  delivery: TakeoutCatalogDelivery;
  foods: TakeoutCatalogFood[];
};

type TakeoutCatalogDraft = {
  shopName: string;
  productName: string;
  price: number;
  combos: Array<{
    name: string;
    extraPrice: number;
  }>;
};

const DEFAULT_ADDRESS = '上海市浦东新区张江高科技园区博云路2号';
const DEFAULT_DISCOUNT = 6.4;

const takeoutComboDraftSchema = z.object({
  name: z.string().trim().min(1).max(40),
  extraPrice: z.preprocess((value) => {
    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'string') {
      return Number(value.replace(/[^\d.]/g, ''));
    }

    return value;
  }, z.number().finite().min(0).max(30)),
});

const takeoutCatalogDraftSchema = z.object({
  shopName: z.string().trim().min(1).max(40),
  productName: z.string().trim().min(1).max(40),
  price: z.preprocess((value) => {
    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'string') {
      return Number(value.replace(/[^\d.]/g, ''));
    }

    return value;
  }, z.number().finite().min(1).max(200)),
  combos: z.array(takeoutComboDraftSchema).max(2).default([]),
});

const takeoutCatalogModelSchema = z.object({
  items: z.array(takeoutCatalogDraftSchema).min(3).max(5),
});

const TAKEOUT_CATALOG_PROMPT = `你是外卖候选生成器。
按用户需求返回 3 个候选商品。
只输出 JSON：
{"items":[{"shopName":"店名","productName":"商品名","price":28,"combos":[{"name":"套餐名","extraPrice":5}]}]}
要求：
- 仅返回 items
- 正好 3 个商品
- price 为数字，不带单位
- combos 最多 2 个
- 候选价格接近
- 店名和商品名要像真实外卖商品`;

const CATEGORY_BLUEPRINTS: Record<string, TakeoutCatalogDraft[]> = {
  咖啡: [
    { shopName: 'Manner Coffee（张江店）', productName: '生椰拿铁', price: 24, combos: [{ name: '生椰拿铁 + 黄油可颂', extraPrice: 8 }, { name: '生椰拿铁 + 巧克力曲奇', extraPrice: 7 }] },
    { shopName: 'NOWWA 挪瓦咖啡（博云路店）', productName: '燕麦拿铁', price: 23, combos: [{ name: '燕麦拿铁 + 葡式蛋挞', extraPrice: 7 }, { name: '燕麦拿铁 + 火腿芝士卷', extraPrice: 8 }] },
    { shopName: '瑞幸咖啡（科苑路店）', productName: '厚乳拿铁', price: 25, combos: [{ name: '厚乳拿铁 + 香草麦芬', extraPrice: 6 }, { name: '厚乳拿铁 + 牛角包', extraPrice: 7 }] },
    { shopName: '库迪咖啡（张衡路店）', productName: '焦糖拿铁', price: 22, combos: [{ name: '焦糖拿铁 + 迷你吐司', extraPrice: 6 }, { name: '焦糖拿铁 + 提拉米苏杯', extraPrice: 9 }] },
  ],
  奶茶: [
    { shopName: '霸王茶姬（张江店）', productName: '伯牙绝弦', price: 21, combos: [{ name: '伯牙绝弦 + 芋泥麻薯', extraPrice: 7 }, { name: '伯牙绝弦 + 蛋挞', extraPrice: 6 }] },
    { shopName: '沪上阿姨（创新中路店）', productName: '杨枝甘露', price: 22, combos: [{ name: '杨枝甘露 + 芝士蛋糕', extraPrice: 8 }, { name: '杨枝甘露 + 小泡芙', extraPrice: 6 }] },
    { shopName: '古茗（科苑路店）', productName: '芝士葡萄', price: 20, combos: [{ name: '芝士葡萄 + 奥利奥蛋糕杯', extraPrice: 8 }, { name: '芝士葡萄 + 小麻薯', extraPrice: 5 }] },
    { shopName: '茶百道（博霞路店）', productName: '豆乳玉麒麟', price: 19, combos: [{ name: '豆乳玉麒麟 + 红糖糍粑', extraPrice: 7 }, { name: '豆乳玉麒麟 + 奶香麻薯', extraPrice: 5 }] },
  ],
  面食: [
    { shopName: '兰州牛肉面馆（张江店）', productName: '招牌牛肉面', price: 32, combos: [{ name: '招牌牛肉面 + 卤蛋', extraPrice: 6 }, { name: '招牌牛肉面 + 冰红茶', extraPrice: 5 }] },
    { shopName: '和府捞面（科苑路店）', productName: '草本汤牛肉面', price: 34, combos: [{ name: '草本汤牛肉面 + 太阳蛋', extraPrice: 6 }, { name: '草本汤牛肉面 + 脆皮鸡排', extraPrice: 8 }] },
    { shopName: '遇见小面（张衡路店）', productName: '豌杂拌面', price: 30, combos: [{ name: '豌杂拌面 + 冰豆浆', extraPrice: 5 }, { name: '豌杂拌面 + 炸蛋', extraPrice: 6 }] },
    { shopName: '陈香贵兰州牛肉面（博云路店）', productName: '番茄牛腩面', price: 31, combos: [{ name: '番茄牛腩面 + 虎皮蛋', extraPrice: 6 }, { name: '番茄牛腩面 + 小凉菜', extraPrice: 7 }] },
  ],
  米饭: [
    { shopName: '黄焖鸡米饭（创新中路店）', productName: '黄焖鸡米饭', price: 28, combos: [{ name: '黄焖鸡米饭 + 可乐', extraPrice: 6 }, { name: '黄焖鸡米饭 + 豆腐', extraPrice: 5 }] },
    { shopName: '小女当家（科苑路店）', productName: '番茄肥牛饭', price: 29, combos: [{ name: '番茄肥牛饭 + 溏心蛋', extraPrice: 5 }, { name: '番茄肥牛饭 + 海带丝', extraPrice: 4 }] },
    { shopName: '真功夫（张江店）', productName: '香菇鸡腿饭', price: 30, combos: [{ name: '香菇鸡腿饭 + 蒸蛋', extraPrice: 5 }, { name: '香菇鸡腿饭 + 鲜豆浆', extraPrice: 6 }] },
    { shopName: '吉野家（博云路店）', productName: '照烧鸡排饭', price: 27, combos: [{ name: '照烧鸡排饭 + 味增汤', extraPrice: 4 }, { name: '照烧鸡排饭 + 茶碗蒸', extraPrice: 6 }] },
  ],
  快餐: [
    { shopName: '麦当劳（张江地铁站店）', productName: '麦辣鸡腿堡套餐', price: 31, combos: [{ name: '麦辣鸡腿堡 + 薯条', extraPrice: 6 }, { name: '麦辣鸡腿堡 + 麦旋风', extraPrice: 8 }] },
    { shopName: '肯德基（科苑路店）', productName: '香辣鸡腿堡餐', price: 32, combos: [{ name: '香辣鸡腿堡 + 蛋挞', extraPrice: 7 }, { name: '香辣鸡腿堡 + 鸡米花', extraPrice: 8 }] },
    { shopName: '塔斯汀（张衡路店）', productName: '藤椒鸡腿中国汉堡', price: 29, combos: [{ name: '藤椒鸡腿汉堡 + 脆薯', extraPrice: 6 }, { name: '藤椒鸡腿汉堡 + 可乐', extraPrice: 5 }] },
    { shopName: '华莱士（博霞路店）', productName: '香辣鸡腿堡', price: 27, combos: [{ name: '香辣鸡腿堡 + 薯条', extraPrice: 5 }, { name: '香辣鸡腿堡 + 鸡块', extraPrice: 7 }] },
  ],
  外卖: [
    { shopName: '兰州牛肉面馆（张江店）', productName: '招牌牛肉面', price: 32, combos: [{ name: '招牌牛肉面 + 卤蛋', extraPrice: 6 }, { name: '招牌牛肉面 + 冰红茶', extraPrice: 5 }] },
    { shopName: '霸王茶姬（张江店）', productName: '伯牙绝弦', price: 21, combos: [{ name: '伯牙绝弦 + 蛋挞', extraPrice: 6 }, { name: '伯牙绝弦 + 小麻薯', extraPrice: 5 }] },
    { shopName: '黄焖鸡米饭（创新中路店）', productName: '黄焖鸡米饭', price: 28, combos: [{ name: '黄焖鸡米饭 + 可乐', extraPrice: 6 }, { name: '黄焖鸡米饭 + 豆腐', extraPrice: 5 }] },
    { shopName: '麦当劳（张江地铁站店）', productName: '麦辣鸡腿堡套餐', price: 31, combos: [{ name: '麦辣鸡腿堡 + 薯条', extraPrice: 6 }, { name: '麦辣鸡腿堡 + 麦旋风', extraPrice: 8 }] },
  ],
};

const PRICE_TIPS = ['一口价', '限时优惠', '免凑单', '店长推荐'];
const COURIER_NAMES = ['李师傅', '王师傅', '张师傅', '陈师傅'];

const createCatalogModel = (): ChatOpenAI | null => {
  const apiKey = process.env.DOUBAO_API_KEY || '';
  const baseURL = process.env.DOUBAO_BASE_URL || '';
  const model = process.env.DOUBAO_MODEL || '';

  if (!apiKey || !baseURL || !model) {
    return null;
  }

  return new ChatOpenAI({
    model,
    apiKey,
    configuration: {
      baseURL,
    },
    temperature: 0.35,
  });
};

const normalizeMessageContent = (content: unknown): string => {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') {
          return item;
        }

        if (typeof item === 'object' && item !== null) {
          const text = (item as { text?: unknown }).text;
          return typeof text === 'string' ? text : '';
        }

        return '';
      })
      .join('')
      .trim();
  }

  return '';
};

const extractJsonPayload = (output: string): string => {
  const fencedMatch = output.match(/```json\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const objectMatch = output.match(/\{[\s\S]*\}/);
  return objectMatch?.[0]?.trim() || output.trim();
};

const hashString = (value: string): number => {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
};

const getSeededNumber = (seed: string, min: number, max: number): number => {
  const hash = hashString(seed);
  const normalized = (hash % 10_000) / 10_000;
  return min + (max - min) * normalized;
};

const sanitizeText = (value: string, fallback: string): string => {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized || fallback;
};

const buildProductTip = (productName: string, prompt: string): string => {
  if (prompt.includes('少辣') || prompt.includes('微辣')) {
    return '支持辣度微调，现做现配';
  }

  if (prompt.includes('少糖') || prompt.includes('无糖')) {
    return '甜度可调，口感清爽';
  }

  if (/拿铁|咖啡/.test(productName)) {
    return '现萃制作，风味平衡';
  }

  if (/奶茶|甘露|果茶/.test(productName)) {
    return '口感细腻，支持冰度甜度调整';
  }

  if (/饭|鸡|盖浇/.test(productName)) {
    return '现炒现配，分量足';
  }

  return '现做现出，口味可调';
};

const buildProductImage = (productName: string, index: number): string => {
  const palettes = [
    ['f0fbf5', '1f2937'],
    ['fff7ed', '7c2d12'],
    ['fefce8', '713f12'],
    ['eff6ff', '1d4ed8'],
  ] as const;
  const palette = palettes[index % palettes.length];

  return `https://dummyimage.com/343x262/${palette[0]}/${palette[1]}&text=${encodeURIComponent(productName)}`;
};

const buildDefaultCombos = (productName: string): TakeoutCatalogDraft['combos'] => {
  if (/拿铁|咖啡/.test(productName)) {
    return [
      { name: `${productName} + 黄油可颂`, extraPrice: 8 },
      { name: `${productName} + 曲奇`, extraPrice: 6 },
    ];
  }

  if (/奶茶|甘露|果茶/.test(productName)) {
    return [
      { name: `${productName} + 小麻薯`, extraPrice: 5 },
      { name: `${productName} + 蛋挞`, extraPrice: 6 },
    ];
  }

  return [
    { name: `${productName} + 可乐`, extraPrice: 5 },
    { name: `${productName} + 卤蛋`, extraPrice: 6 },
  ];
};

const rebalanceCandidatePrices = (drafts: TakeoutCatalogDraft[]): number[] => {
  const prices = drafts.map((item) => Math.round(item.price));
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  if (maxPrice - minPrice <= 8) {
    return prices.map((price) => Math.max(12, price));
  }

  const averagePrice = Math.round(prices.reduce((total, price) => total + price, 0) / prices.length);

  return prices.map((_price, index) => {
    const offset = Math.round((index - (prices.length - 1) / 2) * 2);
    return Math.max(12, averagePrice + offset);
  });
};

export const deriveCatalogDiscount = (prices: number[]): number => {
  if (prices.length === 0) {
    return DEFAULT_DISCOUNT;
  }

  const averagePrice = prices.reduce((total, price) => total + price, 0) / prices.length;
  const calculatedDiscount = averagePrice * 0.18 + 1.2;

  return Number(Math.max(4.5, Math.min(8.8, calculatedDiscount)).toFixed(1));
};

const buildCatalogFoods = (drafts: TakeoutCatalogDraft[], prompt: string): TakeoutCatalogFood[] => {
  const normalizedPrices = rebalanceCandidatePrices(drafts);

  return drafts.slice(0, 3).map((draft, index) => {
    const seed = `${prompt}-${draft.shopName}-${draft.productName}-${index}`;
    const score = Number((4.6 + getSeededNumber(`${seed}-score`, 0, 0.3)).toFixed(1));
    const distance = `${getSeededNumber(`${seed}-distance`, 1.1, 2.8).toFixed(1)}km`;
    const deliveryMinutes = Math.round(getSeededNumber(`${seed}-eta`, 22, 31));
    const priceTip = PRICE_TIPS[index % PRICE_TIPS.length];
    const combos = (draft.combos.length > 0 ? draft.combos : buildDefaultCombos(draft.productName)).slice(0, 2);

    return {
      id: `food-${hashString(seed).toString(36)}`,
      shopName: sanitizeText(draft.shopName, `附近商家${index + 1}`),
      shopScore: score,
      distance,
      productName: sanitizeText(draft.productName, `推荐商品${index + 1}`),
      productTip: buildProductTip(draft.productName, prompt),
      productImage: buildProductImage(draft.productName, index),
      priceTip,
      name: sanitizeText(draft.productName, `推荐商品${index + 1}`),
      price: normalizedPrices[index],
      deliveryTime: `${deliveryMinutes}分钟`,
      combos: combos.map((combo, comboIndex) => ({
        id: `combo-${hashString(`${seed}-${combo.name}-${comboIndex}`).toString(36)}`,
        name: sanitizeText(combo.name, `套餐${comboIndex + 1}`),
        extraPrice: Math.max(0, Math.round(combo.extraPrice)),
      })),
    };
  });
};

const buildDeliveryInfo = (prompt: string): TakeoutCatalogDelivery => {
  const minutes = Math.round(getSeededNumber(`${prompt}-delivery`, 24, 30));
  const courierIndex = Math.floor(getSeededNumber(`${prompt}-courier`, 0, COURIER_NAMES.length - 0.01));
  const suffix = Math.round(getSeededNumber(`${prompt}-phone`, 1000, 9999));

  return {
    eta: `预计${minutes}分钟送达`,
    courier: `配送员：${COURIER_NAMES[courierIndex]} 139xxxx${suffix}`,
  };
};

const buildFallbackCatalogDrafts = (prompt: string): TakeoutCatalogDraft[] => {
  const intent = analyzeTakeoutIntent({ prompt });
  const category = intent.slots.dishType || '外卖';
  const blueprints = CATEGORY_BLUEPRINTS[category] || CATEGORY_BLUEPRINTS.外卖;
  const startIndex = hashString(prompt) % blueprints.length;

  return Array.from({ length: 3 }, (_item, index) => {
    return blueprints[(startIndex + index) % blueprints.length];
  });
};

const buildFallbackCatalog = (prompt: string, address?: string): TakeoutCatalogResult => {
  const foods = buildCatalogFoods(buildFallbackCatalogDrafts(prompt), prompt);

  return {
    source: 'fallback',
    address: address?.trim() || DEFAULT_ADDRESS,
    discount: deriveCatalogDiscount(foods.map((food) => food.price)),
    delivery: buildDeliveryInfo(prompt),
    foods,
  };
};

const parseModelCatalog = (output: string): TakeoutCatalogDraft[] => {
  const jsonPayload = extractJsonPayload(output);
  const parsed = JSON.parse(jsonPayload) as unknown;
  return takeoutCatalogModelSchema.parse(parsed).items.map((item) => ({
    shopName: sanitizeText(item.shopName, '附近商家'),
    productName: sanitizeText(item.productName, '推荐商品'),
    price: Math.round(item.price),
    combos: item.combos.map((combo) => ({
      name: sanitizeText(combo.name, '推荐套餐'),
      extraPrice: Math.round(combo.extraPrice),
    })),
  }));
};

export const generateTakeoutCatalog = async (params: {
  prompt: string;
  address?: string;
}): Promise<TakeoutCatalogResult> => {
  const prompt = params.prompt.trim() || '帮我点外卖';
  const model = createCatalogModel();

  if (!model) {
    return buildFallbackCatalog(prompt, params.address);
  }

  try {
    const response = await model.invoke([
      new SystemMessage(TAKEOUT_CATALOG_PROMPT),
      new HumanMessage(prompt),
    ]);
    const output = normalizeMessageContent(response.content);
    const drafts = parseModelCatalog(output);
    const foods = buildCatalogFoods(drafts, prompt);

    return {
      source: 'model',
      address: params.address?.trim() || DEFAULT_ADDRESS,
      discount: deriveCatalogDiscount(foods.map((food) => food.price)),
      delivery: buildDeliveryInfo(prompt),
      foods,
    };
  } catch {
    return buildFallbackCatalog(prompt, params.address);
  }
};