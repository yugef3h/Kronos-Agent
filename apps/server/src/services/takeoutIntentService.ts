export type TakeoutIntent = 'takeout_order' | 'takeout_recommend' | 'non_takeout';

export type TakeoutSlots = {
  dishType: string | null;
  addressHint: string | null;
  budgetRange: string | null;
  timeConstraint: string | null;
  tastePreference: string[];
};

export type TakeoutIntentAnalysis = {
  intent: TakeoutIntent;
  confidence: number;
  slots: TakeoutSlots;
  missingSlots: Array<'dishType' | 'addressHint' | 'budgetRange' | 'timeConstraint'>;
  nextAction: 'start_takeout_flow' | 'ask_for_slot' | 'fallback_to_chat';
};

const TAKEOUT_KEYWORDS = [
  '外卖', '点餐', '下单', '帮我点', '订餐', '奶茶', '咖啡', '牛肉面', '酸辣粉', '黄焖鸡', '午饭', '晚饭',
];

const NEGATIVE_KEYWORDS = ['菜谱', '做法', '怎么做', '教程', '营养', '热量', '门店测评', '点评'];

const DISH_KEYWORDS: Array<{ dishType: string; words: string[] }> = [
  { dishType: '咖啡', words: ['咖啡', '拿铁', '美式', '生椰'] },
  { dishType: '奶茶', words: ['奶茶', '果茶', '杨枝甘露'] },
  { dishType: '面食', words: ['牛肉面', '面条', '拉面'] },
  { dishType: '米饭', words: ['黄焖鸡', '米饭', '盖饭'] },
  { dishType: '快餐', words: ['汉堡', '炸鸡', '薯条'] },
];

const TASTE_PATTERNS = ['少糖', '无糖', '去冰', '热饮', '少辣', '微辣', '不要香菜'];

const clampConfidence = (value: number): number => {
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
};

const readDishType = (prompt: string): string | null => {
  const lowered = prompt.toLowerCase();
  const matched = DISH_KEYWORDS.find((item) => item.words.some((word) => lowered.includes(word.toLowerCase())));
  return matched?.dishType || null;
};

const readAddressHint = (prompt: string): string | null => {
  const explicitAddress = prompt.match(/(?:送到|送至|到)([^，。,；;]+)/);
  if (explicitAddress?.[1]) {
    return explicitAddress[1].trim();
  }

  if (prompt.includes('公司')) return '公司';
  if (prompt.includes('家里') || prompt.includes('回家') || prompt.includes('家')) return '家';
  return null;
};

const readBudgetRange = (prompt: string): string | null => {
  const matched = prompt.match(/(\d+)\s*元(?:以内|以下|内)?/);
  if (!matched?.[1]) {
    return null;
  }

  return `<=${matched[1]}`;
};

const readTimeConstraint = (prompt: string): string | null => {
  if (/尽快|马上|现在/.test(prompt)) return 'asap';
  if (/早餐|早上/.test(prompt)) return 'breakfast';
  if (/午餐|中午|午饭/.test(prompt)) return 'lunch';
  if (/晚餐|晚上|晚饭/.test(prompt)) return 'dinner';
  if (/夜宵/.test(prompt)) return 'night';
  return null;
};

const readTastePreference = (prompt: string): string[] => {
  return TASTE_PATTERNS.filter((item) => prompt.includes(item));
};

const hasAnyKeyword = (prompt: string, keywords: string[]): boolean => {
  return keywords.some((word) => prompt.includes(word));
};

export const analyzeTakeoutIntent = (params: {
  prompt: string;
  history?: string[];
}): TakeoutIntentAnalysis => {
  const history = params.history || [];
  const prompt = params.prompt.trim();
  const context = `${history.join(' ')} ${prompt}`;

  const hasTakeoutSignal = hasAnyKeyword(context, TAKEOUT_KEYWORDS);
  const hasNegativeSignal = hasAnyKeyword(context, NEGATIVE_KEYWORDS);
  const hasOrderVerb = /帮我点|下单|订|来一份|买/.test(context);

  const slots: TakeoutSlots = {
    dishType: readDishType(context),
    addressHint: readAddressHint(context),
    budgetRange: readBudgetRange(context),
    timeConstraint: readTimeConstraint(context),
    tastePreference: readTastePreference(context),
  };

  let score = 0;

  if (hasTakeoutSignal) score += 0.42;
  if (hasOrderVerb) score += 0.28;
  if (slots.dishType) score += 0.14;
  if (slots.addressHint) score += 0.08;
  if (slots.budgetRange) score += 0.05;
  if (slots.timeConstraint) score += 0.05;
  if (hasNegativeSignal) score -= 0.55;

  const confidence = clampConfidence(score);

  let intent: TakeoutIntent = 'non_takeout';
  if (confidence >= 0.8) {
    intent = hasOrderVerb ? 'takeout_order' : 'takeout_recommend';
  } else if (confidence >= 0.5) {
    intent = 'takeout_recommend';
  }

  const missingSlots: Array<'dishType' | 'addressHint' | 'budgetRange' | 'timeConstraint'> = [];
  if (!slots.dishType) missingSlots.push('dishType');
  if (!slots.addressHint) missingSlots.push('addressHint');
  if (!slots.budgetRange) missingSlots.push('budgetRange');
  if (!slots.timeConstraint) missingSlots.push('timeConstraint');

  let nextAction: TakeoutIntentAnalysis['nextAction'] = 'fallback_to_chat';
  if (intent === 'takeout_order' && confidence >= 0.8) {
    nextAction = 'start_takeout_flow';
  } else if (intent !== 'non_takeout') {
    nextAction = 'ask_for_slot';
  }

  return {
    intent,
    confidence,
    slots,
    missingSlots,
    nextAction,
  };
};
