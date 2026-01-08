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
 * 与 `/workflow/config` 调试区「与 Bot 聊天」一致：检索 + 系统提示（含 `{{var}}`）+ 用户问题；
 * 未命中假发布 Chatbot 时原样返回用户输入，供普通 Playground 对话使用。
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
