/**
 * RAG 包导出。端到端「搜索 → 给 LLM」在仓库中的分工：
 * - 本包 `runKnowledgeRetrievalQuery`：只负责搜索与打分（见 knowledgeFacade / knowledgeRetrievalService / langchain/vectorRetrieval）
 * - 前端 `buildChatbotAugmentedUserPrompt`：检索结果 → Markdown 上下文块
 * - `POST /api/chat-stream`：LLM 根据拼接后的 prompt 生成最终回复（整理、突出重点由模型完成）
 */
export * from './knowledgeFacade.js';
export * from './types.js';
