import { HOT_TOPIC_PROMPTS } from '../../components/chatHotTopics';

import type { PromptQuickAction } from './types';

export const MAX_CONTEXT_TOKENS = 8192;
/** P4-W-02: 与后端 AI_CHAT_ASYNC_THRESHOLD_CHARS 默认一致 */
export const CHAT_ASYNC_THRESHOLD_CHARS = 12_000;
export const TAKEOUT_QUICK_ACTION_REPLY = '好呀，你想吃点什么呢？';
export const TAKEOUT_QUICK_ACTION_REPLY_DELAY_MS = 600;
export const IMAGE_DEFAULT_PROMPT = '解释图片';
export const FILE_DEFAULT_PROMPT = '请解读这个文件';
export const HOT_TOPICS_CACHE_KEY = 'kronos.hot-topics';
export const STREAM_TYPEWRITER_DELAY_MS = 32;
/** 距底部小于该像素时视为「贴底」，流式更新会继续自动滚动 */
export const MESSAGE_LIST_STICK_THRESHOLD_PX = 80;

export const PROMPT_QUICK_ACTIONS: readonly PromptQuickAction[] = [
  { key: 'image', label: '图像' },
  { key: 'file', label: '文件' },
  { key: 'takeout', label: '外卖' },
];

export const STAGE_LABEL_MAP = {
  plan: '规划',
  tool: '工具',
  reason: '推理',
} as const;

export const STATUS_LABEL_MAP = {
  start: '开始',
  end: '完成',
  info: '信息',
} as const;

export const DEFAULT_HOT_TOPICS = [...HOT_TOPIC_PROMPTS];