import { OpenAIEmbeddings } from '@langchain/openai';

/**
 * 知识库检索/入库共用的 LangChain `OpenAIEmbeddings` 工厂。
 * **入库**（`importKnowledgeDocument`）与 **检索补全/查询向量**（`vectorRetrieval`）须共用本函数，且部署期保持同一 `DOUBAO_EMBEDDING_MODEL`（或 `DOUBAO_MODEL`）与 `DOUBAO_BASE_URL`，否则余弦相似度不可比。
 * 使用 `process.env` 而非 `config/env.ts`，避免 Jest 编译 `import.meta` 时拉取整条配置图；与 `tokenEmbeddingService` 同源变量名。
 * 多查询改写（`RAG_LC_MULTI_QUERY`）复用同一套 `DOUBAO_*` 聊天凭据，见 `expandRetrievalQueries.ts`。
 */
export function createRagEmbeddings(): OpenAIEmbeddings {
  const model = process.env.DOUBAO_EMBEDDING_MODEL?.trim() || process.env.DOUBAO_MODEL || '';
  const apiKey = process.env.DOUBAO_API_KEY;
  const baseURL = process.env.DOUBAO_BASE_URL;
  if (!apiKey?.trim() || !baseURL?.trim() || !model.trim()) {
    throw new Error('RAG embeddings require DOUBAO_API_KEY, DOUBAO_BASE_URL, and DOUBAO_MODEL or DOUBAO_EMBEDDING_MODEL');
  }
  return new OpenAIEmbeddings({
    model,
    apiKey,
    configuration: {
      baseURL,
    },
  });
}
