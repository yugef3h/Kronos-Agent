import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import { analyzeTakeoutIntent } from './takeoutIntentService.js';

export type TakeoutOrchestrationAction = 'chat' | 'ask_slot' | 'tool_call';

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

const TAKEOUT_ORCHESTRATION_PROMPT = `你是聊天+外卖助手。
先判断是否为点外卖意图：
1) 无外卖意图：正常闲聊。
2) 有外卖意图但缺 food：自然追问补全。
3) 有外卖意图且 food 完整：准备调用外卖工具。

输出要求：
- 给用户看的回复要简洁自然。
- 最后一行必须且只能是以下之一：
  [[CHAT]]
  [[ASK_SLOT]]
  [[TAKEOUT_TOOL]]{"food":"菜品"}
`;

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

export const parseTakeoutOrchestrationOutput = (output: string): TakeoutOrchestrationResult => {
  const toolMatch = output.match(/\[\[TAKEOUT_TOOL\]\](\{[\s\S]*\})/);
  const hasAskSlotTag = output.includes('[[ASK_SLOT]]');
  const hasChatTag = output.includes('[[CHAT]]');

  const assistantReply = output
    .replace(/\[\[TAKEOUT_TOOL\]\]\{[\s\S]*\}/g, '')
    .replace(/\[\[ASK_SLOT\]\]/g, '')
    .replace(/\[\[CHAT\]\]/g, '')
    .trim();

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

  // 兼容模型未按标签输出的情况，默认走聊天分支。
  return {
    action: 'chat',
    assistantReply,
  };
};

export const orchestrateTakeoutPrompt = async (params: {
  prompt: string;
  history?: string[];
}): Promise<TakeoutOrchestrationResult> => {
  const history = params.history || [];

  try {
    const orchestratorModel = createOrchestratorModel();

    const response = await orchestratorModel.invoke([
      new SystemMessage(TAKEOUT_ORCHESTRATION_PROMPT),
      ...history.map((item) => new HumanMessage(`上下文片段：${item}`)),
      new HumanMessage(params.prompt),
    ]);

    const output = normalizeMessageContent(response.content);
    return parseTakeoutOrchestrationOutput(output);
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
      action: 'chat',
      assistantReply: '收到，我在。你可以直接告诉我你现在想做什么。',
    };
  }
};
