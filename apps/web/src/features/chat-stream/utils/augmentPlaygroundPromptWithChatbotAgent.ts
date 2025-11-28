import {
  createDefaultChatbotOrchestration,
  getWorkflowAppById,
} from '../../workflow/workflowAppStore';
import { requestKnowledgeRetrievalQuery } from '../../../lib/api';
import { buildChatbotRetrievalInput } from '../../../pages/workflow/config-page/chatbotRetrievalInput';
import { applyPromptVariables } from '../../../pages/workflow/config-page/promptVariablesUtils';
import { ensureKnowledgeDatasetAuthToken } from '../../../pages/workflow/features/knowledge-retrieval-panel/dataset-store';

/**
 * 将首页用户输入按已发布 Chatbot 编排做检索与系统提示拼接（与编排页调试区逻辑对齐），供 `/api/chat-stream` 使用。
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
  const token = params.authToken.trim().length > 0 ? params.authToken.trim() : await ensureKnowledgeDatasetAuthToken();

  let contextBlock = '';
  if (orch.datasetIds.length > 0) {
    const retrieval = await requestKnowledgeRetrievalQuery({
      authToken: token,
      input: buildChatbotRetrievalInput(params.userPrompt, orch),
    });
    contextBlock =
      retrieval.items.length > 0
        ? retrieval.items.map((item, i) => `[${i + 1}] ${item.text}`).join('\n\n')
        : '（本次检索无命中片段，请检查知识库或 query。）';
  }

  const values: Record<string, string> = {};
  for (const v of orch.promptVariables ?? []) {
    values[v.key] = '';
  }
  const baseSystem = orch.systemPrompt.trim() || '你是帮助用户的助手。';
  const resolvedSystem = applyPromptVariables(baseSystem, values);

  return [resolvedSystem, orch.datasetIds.length > 0 ? `## 知识库检索上下文\n${contextBlock}` : '', `## 当前用户问题\n${params.userPrompt}`]
    .filter(Boolean)
    .join('\n\n');
};
