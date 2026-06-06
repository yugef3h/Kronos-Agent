# Wave 2 — RAG 迁移清单

- [x] RAG 类型 + 契约（query/preview/import types, contract asserts）
- [x] 评分/指标纯函数（BM25 tokenize, cosine, recall@k, MRR）
- [x] Store 读 stub（dataset/document list，空目录安全）
- [x] `RAG_ROUTES_ENABLED` 默认 false，路由 501 stub
- [ ] 移植 `knowledgeFacade.ts` → `app/rag/facade.py`
- [ ] 读写 `apps/server/data/knowledge-*` 共用目录（真实检索）
- [ ] compare / evaluate API 实装
- [ ] `pnpm test:py` 契约测试与 Node 基线对齐
