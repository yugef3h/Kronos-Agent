import {
  createDefaultChatbotOrchestration,
  getWorkflowAppById,
} from '../../workflow/workflowAppStore';
import { buildChatbotAugmentedUserPrompt } from '../../workflow/chatbotAugmentedStreamPrompt';

/**
 * 将首页用户输入按已发布 Chatbot 编排做检索与系统提示拼接（与编排页调试区 `buildChatbotAugmentedUserPrompt` 对齐），供 `/api/chat-stream` 使用。
 */
export const augmentPlaygroundPromptWithChatbotAgent = async (params: {
  authToken: string;
  userPrompt: string;
  workflowAppId: string;
}): Promise<string> => {
  const app = getWorkflowAppById(params.workflowAppId);
  if (!app || app.dsl.app.mode !== 'chat' || !app.mockPublished) {
    return params.userPrompt;
  }

  const orch = app.chatbotOrchestration ?? createDefaultChatbotOrchestration();
  return buildChatbotAugmentedUserPrompt({
    authToken: params.authToken,
    userQuery: params.userPrompt,
    orch,
  });
};
