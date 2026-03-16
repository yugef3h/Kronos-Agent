export type TakeoutCombo = {
  id: string;
  name: string;
  extraPrice: number;
};

export type TakeoutFood = {
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
  combos: TakeoutCombo[];
};

export const MOCK_ADDRESS = '上海市浦东新区张江高科技园区博云路2号';

export const MOCK_DISCOUNT = 12.8;

export const MOCK_FOODS: TakeoutFood[] = [
  {
    id: 'beef-noodle',
    shopName: '兰州牛肉面馆（张江店）',
    shopScore: 4.8,
    distance: '1.6km',
    productName: '招牌牛肉面',
    productTip: '现做现煮，口味可调',
    productImage:
      'https://dummyimage.com/343x262/f0fbf5/1f2937&text=%E6%8B%9B%E7%89%8C%E7%89%9B%E8%82%89%E9%9D%A2',
    priceTip: '一口价 免凑单',
    name: '招牌牛肉面',
    price: 32,
    deliveryTime: '28分钟',
    combos: [
      { id: 'beef-noodle-egg', name: '牛肉面 + 卤蛋', extraPrice: 6 },
      { id: 'beef-noodle-tea', name: '牛肉面 + 冰红茶', extraPrice: 5 },
    ],
  },
  {
    id: 'sour-spicy',
    shopName: '川味小馆（科苑路店）',
    shopScore: 4.7,
    distance: '1.9km',
    productName: '酸辣粉套餐',
    productTip: '酸辣开胃，建议微辣起步',
    productImage:
      'https://dummyimage.com/343x262/fff7ed/7c2d12&text=%E9%85%B8%E8%BE%A3%E7%B2%89%E5%A5%97%E9%A4%90',
    priceTip: '限时优惠',
    name: '酸辣粉套餐',
    price: 26,
    deliveryTime: '24分钟',
    combos: [
      { id: 'sour-spicy-jelly', name: '酸辣粉 + 冰粉', extraPrice: 8 },
      { id: 'sour-spicy-roll', name: '酸辣粉 + 红糖糍粑', extraPrice: 9 },
    ],
  },
  {
    id: 'chicken-rice',
    shopName: '黄焖鸡米饭（创新中路店）',
    shopScore: 4.9,
    distance: '2.1km',
    productName: '黄焖鸡米饭',
    productTip: '米饭可免费加量一次',
    productImage: 'https://dummyimage.com/343x262/fefce8/713f12&text=快餐',
    priceTip: '一口价',
    name: '黄焖鸡米饭',
    price: 28,
    deliveryTime: '25-32分钟',
    combos: [
      { id: 'chicken-rice-cola', name: '黄焖鸡米饭 + 可乐', extraPrice: 6 },
      { id: 'chicken-rice-tofu', name: '黄焖鸡米饭 + 豆腐', extraPrice: 5 },
    ],
  },
];

export const MOCK_DELIVERY = {
  eta: '预计25分钟送达',
  courier: '配送员：李师傅 139xxxx5678',
};