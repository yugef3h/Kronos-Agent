# Python 主分支 — Wave 2 增量 50 Commit 计划

> 分支：`feat/py` | Wave 1 已完成（100/100）| 本计划 **纯增量**，默认不注册 RAG 路由、不改 chat-stream

## 评估：现在可做的项

| 状态 | 项 | 说明 |
| --- | --- | --- |
| ✅ 已完成 | Wave 1 Guardrail/Tools/Agent | 26 pytest 通过 |
| ✅ 可立即做 | RAG 类型 + 契约 | 镜像 Node `knowledgeRagApiContract`，零运行时影响 |
| ✅ 可立即做 | 评分/指标纯函数 | BM25 tokenize、cosine、recall@k、MRR |
| ✅ 可立即做 | Store 读 stub | 空目录返回 `[]`，不碰 Node 数据写路径 |
| ✅ 可立即做 | 契约测试补全 | complete sessionId、guardrail timeline |
| ✅ 可立即做 | conftest fixtures | 共享 RAG 样例 |
| ⚠️ 默认关闭 | knowledge 路由 | `RAG_ROUTES_ENABLED=false`，注册也返回 501 |
| ❌ 暂缓 | facade 真实检索 | 需对齐 Node hybrid，Wave 2b |
| ❌ 暂缓 | Workflow 执行器实装 | Wave 3 |

---

## 50 Commit 清单

### §1 文档 (1)
1. `docs: add wave2 50-commit iteration plan`

### §2 RAG 路径与类型 (2-7)
2. `feat(rag): add paths module for knowledge data dirs`
3. `test(rag): paths default to server data root`
4. `feat(rag): add query request types mirroring node`
5. `feat(rag): add dataset and document record types`
6. `test(rag): contract accepts query_variants in diagnostics`
7. `feat(rag): add preview and import result types`

### §3 评分与过滤 (8-15)
8. `feat(rag): add bm25 tokenize helper`
9. `test(rag): tokenize splits ascii words`
10. `feat(rag): add cosine similarity helper`
11. `test(rag): cosine identical vectors score one`
12. `feat(rag): add metadata filter evaluator`
13. `test(rag): metadata contains filter passes`
14. `feat(rag): add hybrid score merge helper`
15. `test(rag): hybrid merge picks higher combined score`

### §4 Eval 指标 (16-20)
16. `feat(rag): add recall_at_k metric helper`
17. `test(rag): recall_at_k counts hits in top k`
18. `feat(rag): add mrr metric helper`
19. `test(rag): mrr returns reciprocal first rank`
20. `test(rag): char_level_f1 ignores whitespace`

### §5 Schema 与 Store stub (21-31)
21. `feat(rag): add pydantic retrieval query schema`
22. `test(rag): schema rejects empty query string`
23. `feat(rag): add compare and eval request types`
24. `test(rag): preview contract validates chunk keys`
25. `feat(rag): dataset store list stub read-only`
26. `test(rag): dataset store returns empty when missing`
27. `feat(rag): document store list chunks stub`
28. `test(rag): document store returns empty chunks`
29. `feat(rag): compare service not-implemented stub`
30. `feat(rag): eval service not-implemented stub`
31. `feat(rag): health check helper for datasets dir`

### §6 契约与 conftest (32-37)
32. `test(conftest): add rag query fixture`
33. `test(conftest): add sample retrieval result fixture`
34. `test(contract): complete event includes sessionId`
35. `test(contract): guardrail blocked yields timeline before content`
36. `test(rag): health reports missing datasets dir`
37. `feat(rag): extend contract with preview item assert`

### §7 配置与路由（默认关） (38-42)
38. `feat(config): add KNOWLEDGE_DATASETS_DIR setting`
39. `feat(config): add RAG_ROUTES_ENABLED flag default off`
40. `feat(routes): add knowledge retrieval router 501 stub`
41. `feat(main): register knowledge router only when flag enabled`
42. `test(rag): knowledge route absent when flag disabled`

### §8 CI 与文档收尾 (43-50)
43. `chore: add test:py optional gate to verify script`
44. `docs: update wave2 rag checklist progress`
45. `feat(rag): export public rag module surface`
46. `test(rag): contract matched_terms must be array`
47. `test(rag): contract metadata must be object`
48. `docs: add wave2 acceptance criteria to plan`
49. `chore(server_py): add rag package logging namespace`
50. `chore(wave2): milestone commit 50/50`

---

## 验收（Wave 2 脚手架完成态）

- [ ] `pnpm test:py` 通过（≥40 tests）
- [ ] `RAG_ROUTES_ENABLED` 默认 false，chat-stream 行为不变
- [ ] RAG 纯函数与契约测试与 Node 字段对齐
- [ ] `verify` 可选跑 pytest
