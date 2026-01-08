import type { WorkflowChatbotOrchestration } from './workflowAppStore';
import { requestKnowledgeRetrievalQuery } from '../../../lib/api';
import { buildChatbotRetrievalInput } from '../editor/config-page/chatbotRetrievalInput';
import { applyPromptVariables } from '../editor/config-page/promptVariablesUtils';
import { ensureKnowledgeDatasetAuthToken } from '../../knowledge/dataset-store';

/**
 * 与 `/workflow/config` 调试区一致：知识库检索 + 系统提示（含 `{{var}}`）+ 当前用户问题段落。
 */
export const buildChatbotAugmentedUserPrompt = async (params: {
  authToken: string;
  userQuery: string;
  orch: WorkflowChatbotOrchestration;
  /** 与编排页「调试变量」表对齐；缺省按 key 给空串 */
  promptVariableValues?: Record<string, string>;
}): Promise<string> => {
  const token =
    params.authToken.trim().length > 0
      ? params.authToken.trim()
      : await ensureKnowledgeDatasetAuthToken();

  let contextBlock = '';
  if (params.orch.datasetIds.length > 0) {
    const retrieval = await requestKnowledgeRetrievalQuery({
      authToken: token,
      input: buildChatbotRetrievalInput(params.userQuery, params.orch),
    });
    contextBlock =
      retrieval.items.length > 0
        ? retrieval.items.map((item, i) => `[${i + 1}] ${item.text}`).join('\n\n')
        : '（本次检索无命中片段，请检查知识库或 query。）';
  }

  const values: Record<string, string> = {};
  for (const v of params.orch.promptVariables ?? []) {
    values[v.key] = params.promptVariableValues?.[v.key] ?? '';
  }
  const baseSystem = params.orch.systemPrompt.trim() || '你是帮助用户的助手。';
  const resolvedSystem = applyPromptVariables(baseSystem, values);

  return [resolvedSystem, params.orch.datasetIds.length > 0 ? `## 知识库检索上下文\n${contextBlock}` : '', `## 当前用户问题\n${params.userQuery}`]
    .filter(Boolean)
    .join('\n\n');
};

/**
 * 已选「假发布」Chatbot 时，与编排页 `workflow-chatbot-${appId}` 类似：按应用隔离服务端会话；
 * 同时带上当前 Playground `sessionId`，避免多开页签互相覆盖。
 */
export const getPlaygroundWorkflowChatStreamSessionId = (
  baseSessionId: string,
  workflowAppId: string | null | undefined,
): string => {
  const id = workflowAppId?.trim();
  if (!id) {
    return baseSessionId;
  }
  return `playground-${baseSessionId}-chatbot-${id}`;
};

const PUBLISHED_PLAYGROUND_STREAM_MARKER = '-chatbot-';

/**
 * 将 `getPlaygroundWorkflowChatStreamSessionId` 生成的快照 sessionId 还原为页签 session + 应用 id。
 * 若 `streamSessionId` 不是该形态则返回 null。
 */
export const tryParsePlaygroundPublishedChatStreamSession = (
  streamSessionId: string,
): { baseSessionId: string; workflowAppId: string } | null => {
  if (!streamSessionId.startsWith('playground-')) {
    return null;
  }
  const markerIndex = streamSessionId.indexOf(PUBLISHED_PLAYGROUND_STREAM_MARKER);
  if (markerIndex < 0) {
    return null;
  }
  const baseSessionId = streamSessionId.slice('playground-'.length, markerIndex);
  const workflowAppId = streamSessionId.slice(markerIndex + PUBLISHED_PLAYGROUND_STREAM_MARKER.length);
  if (!baseSessionId || !workflowAppId) {
    return null;
  }
  return { baseSessionId, workflowAppId };
};
