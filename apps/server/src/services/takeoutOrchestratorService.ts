import { ChatOpenAI } from '@langchain/openai';
import {
  buildTakeoutOrchestrationHistory,
  takeoutOrchestrationChatPrompt,
} from '../prompts/takeoutOrchestrationPrompt.js';
import { analyzeTakeoutIntent, hasTakeoutSignals, isClearlyNonTakeout } from './takeoutIntentService.js';

export type TakeoutOrchestrationAction = 'chat' | 'ask_slot' | 'tool_call' | 'delegate_chat_stream';

export type TakeoutOrchestrationResult = {
  action: TakeoutOrchestrationAction;
  assistantReply: string;
  toolCall?: {
    name: 'takeout';
    params: {
      food: string;
    };
  };
};

const createOrchestratorModel = (): ChatOpenAI => {
  const apiKey = process.env.DOUBAO_API_KEY || '';
  const baseURL = process.env.DOUBAO_BASE_URL || '';
  const model = process.env.DOUBAO_MODEL || '';

  if (!apiKey || !baseURL || !model) {
    throw new Error('Doubao model env is not fully configured');
  }

  return new ChatOpenAI({
    model,
    apiKey,
    configuration: {
      baseURL,
    },
    temperature: 0.2,
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

export const parseTakeoutOrchestrationOutput = (
  output: string,
  prompt: string,
  history: string[] = [],
): TakeoutOrchestrationResult => {
  const toolMatch = output.match(/\[\[TAKEOUT_TOOL\]\](\{[\s\S]*\})/);
  const hasAskSlotTag = output.includes('[[ASK_SLOT]]');
  const hasChatTag = output.includes('[[CHAT]]');
  const hasDelegateTag = output.includes('[[DELEGATE]]');

  const assistantReply = output
    .replace(/\[\[TAKEOUT_TOOL\]\]\{[\s\S]*\}/g, '')
    .replace(/\[\[ASK_SLOT\]\]/g, '')
    .replace(/\[\[CHAT\]\]/g, '')
    .replace(/\[\[DELEGATE\]\]/g, '')
    .trim();

  if (hasDelegateTag) {
    return {
      action: 'delegate_chat_stream',
      assistantReply: '',
    };
  }

  if (toolMatch?.[1]) {
    try {
      const parsed = JSON.parse(toolMatch[1]) as { food?: unknown };
      const food = typeof parsed.food === 'string' ? parsed.food.trim() : '';

      if (food.length > 0) {
        return {
          action: 'tool_call',
          assistantReply,
          toolCall: {
            name: 'takeout',
            params: { food },
          },
        };
      }
    } catch {
      return {
        action: 'ask_slot',
        assistantReply: assistantReply || '你想点什么外卖？告诉我菜品我就帮你安排。',
      };
    }
  }

  if (hasAskSlotTag) {
    return {
      action: 'ask_slot',
      assistantReply: assistantReply || '你想点什么外卖？告诉我菜品我就帮你安排。',
    };
  }

  if (hasChatTag) {
    return {
      action: 'chat',
      assistantReply,
    };
  }

  // 模型未打标签：仅在高置信非外卖且无外卖信号时交回 Playground Agent。
  if (isClearlyNonTakeout({ prompt, history })) {
    return {
      action: 'delegate_chat_stream',
      assistantReply: '',
    };
  }

  const ruleAnalysis = analyzeTakeoutIntent({ prompt, history });
  if (ruleAnalysis.nextAction === 'start_takeout_flow') {
    return {
      action: 'tool_call',
      assistantReply: assistantReply || '好的，这就帮你安排外卖。',
      toolCall: {
        name: 'takeout',
        params: {
          food: ruleAnalysis.slots.dishType || '外卖',
        },
      },
    };
  }

  if (ruleAnalysis.nextAction === 'ask_for_slot' || hasTakeoutSignals({ prompt, history })) {
    return {
      action: 'ask_slot',
      assistantReply: assistantReply || '可以，想吃什么？告诉我菜品我就帮你继续。',
    };
  }

  return {
    action: 'chat',
    assistantReply: assistantReply || output.trim(),
  };
};

export const orchestrateTakeoutPrompt = async (params: {
  prompt: string;
  history?: string[];
}): Promise<TakeoutOrchestrationResult> => {
  const history = params.history || [];

  if (isClearlyNonTakeout({ prompt: params.prompt, history })) {
    return {
      action: 'delegate_chat_stream',
      assistantReply: '',
    };
  }

  try {
    const orchestratorModel = createOrchestratorModel();

    const messages = await takeoutOrchestrationChatPrompt.formatMessages({
      history: buildTakeoutOrchestrationHistory(history),
      prompt: params.prompt,
    });
    const response = await orchestratorModel.invoke(messages);

    const output = normalizeMessageContent(response.content);
    return parseTakeoutOrchestrationOutput(output, params.prompt, history);
  } catch {
    // 模型不可用时使用规则兜底，保证前端体验不断流。
    const fallback = analyzeTakeoutIntent({ prompt: params.prompt, history });

    if (fallback.nextAction === 'start_takeout_flow') {
      return {
        action: 'tool_call',
        assistantReply: '好的，这就帮你安排外卖。',
        toolCall: {
          name: 'takeout',
          params: {
            food: fallback.slots.dishType || '外卖',
          },
        },
      };
    }

    if (fallback.nextAction === 'ask_for_slot') {
      return {
        action: 'ask_slot',
        assistantReply: '可以，想吃什么？告诉我菜品我就帮你继续。',
      };
    }

    return {
      action: 'delegate_chat_stream',
      assistantReply: '',
    };
  }
};
