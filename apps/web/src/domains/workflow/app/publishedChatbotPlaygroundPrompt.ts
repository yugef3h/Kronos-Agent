import { buildChatbotAugmentedUserPrompt } from './chatbotAugmentedStreamPrompt';
import {
  createDefaultChatbotOrchestration,
  getWorkflowAppById,
  type WorkflowChatbotOrchestration,
} from './workflowAppStore';

/**
 * Playground 选中「假发布」Chatbot 时的编排解析（与编排页调试区读同一份 store，不包含 UI）。
 */
export type PublishedChatbotPlaygroundResolution =
  | { kind: 'inactive' }
  | { kind: 'active'; orch: WorkflowChatbotOrchestration };

export const resolvePublishedChatbotForPlayground = (
  workflowAppId: string,
): PublishedChatbotPlaygroundResolution => {
  const app = getWorkflowAppById(workflowAppId);
  if (!app || app.dsl.app.mode !== 'chat' || !app.mockPublished) {
    return { kind: 'inactive' };
  }
  return {
    kind: 'active',
    orch: app.chatbotOrchestration ?? createDefaultChatbotOrchestration(),
  };
};

/**
 * Playground 选中假发布 Chatbot 时走 RAG（与 `/workflow/config` 调试区相同）：
 * `buildChatbotAugmentedUserPrompt` → 检索 + 拼 prompt → `/api/chat-stream` 生成回答。
 * 未选中时原样返回 userQuery，走普通 Agent 对话。
 */
export const buildPublishedChatbotPlaygroundAugmentedPrompt = async (params: {
  authToken: string;
  userQuery: string;
  workflowAppId: string;
  promptVariableValues?: Record<string, string>;
}): Promise<string> => {
  const resolved = resolvePublishedChatbotForPlayground(params.workflowAppId);
  if (resolved.kind === 'inactive') {
    return params.userQuery;
  }
  return buildChatbotAugmentedUserPrompt({
    authToken: params.authToken,
    userQuery: params.userQuery,
    orch: resolved.orch,
    promptVariableValues: params.promptVariableValues,
  });
};
