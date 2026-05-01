import type { WorkflowChatbotOrchestration } from './workflowAppStore';
import { requestKnowledgeRetrievalQuery } from '../../../lib/api';
import { buildChatbotRetrievalInput } from '../editor/config-page/chatbotRetrievalInput';
import { applyPromptVariables } from '../editor/config-page/promptVariablesUtils';
import { ensureKnowledgeDatasetAuthToken } from '../../knowledge/dataset-store';

/**
 * Chatbot / Playground「假发布」RAG 生成链路（检索与 LLM 生成分两阶段）：
 *
 * ① 检索（服务端，无二次 LLM 整理 chunk）：
 *    `requestKnowledgeRetrievalQuery` → POST `/api/workflow/knowledge-retrieval/query`
 *    → `knowledgeFacade.runKnowledgeRetrievalQuery`（`RAG_ENGINE_MODE` 切 self / langchain）
 *    → Top-K chunk 列表（含 score、matched_terms）。
 *
 * ② 拼 prompt（本文件，前端）：
 *    将命中片段格式化为 `[1] 文本\n\n[2] 文本`，写入 `## 知识库检索上下文`，
 *    再拼接系统提示（`{{var}}` 替换）与 `## 当前用户问题`。
 *
 * ③ LLM 整理/突出（服务端 `/api/chat-stream`）：
 *    整段 augmented 作为 `prompt` 送入线性 Agent / LangGraph；
 *    由模型根据上下文组织答案、引用要点——无单独的「摘要/高亮」后处理服务。
 *
 * 工作流画布路径：知识检索节点只产出 `result`/`documents`；下游 LLM 节点在 Prompt 里
 * 用 `{{context}}` / `{{#knowledge-1.result#}}` 等变量接入，逻辑等价于本函数的 ②③。
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

  // —— 阶段 ①：按用户问句检索知识库 chunk（详见 apps/server/src/rag/knowledgeFacade.ts）
  let contextBlock = '';
  if (params.orch.datasetIds.length > 0) {
    const retrieval = await requestKnowledgeRetrievalQuery({
      authToken: token,
      input: buildChatbotRetrievalInput(params.userQuery, params.orch),
    });
    // —— 阶段 ②：把 chunk 编号拼接为纯文本上下文（不做 LLM 压缩，留给 chat-stream 生成）
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

  // —— 阶段 ② 收尾：单条 user-facing prompt（含系统设定 + 检索上下文 + 原问句）→ 阶段 ③ chat-stream
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
