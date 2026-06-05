# Python 主分支 — 100 Commit 迭代计划

> 分支：`feat/py` | Wave 1 执行中 | 对照 [`Python主分支分析.md`](./Python主分支分析.md)

## 评估：先做哪几项

| 优先级 | 项 | 理由 | Commit 区间 |
| --- | --- | --- | --- |
| **P0** | 默认 runtime=py | 叙事切换，零业务风险 | 1-3 |
| **P0** | Guardrail | Node 已有，Python 镜像缺口，独立可测 | 4-15 |
| **P0** | Tools + web_search | LangGraph 前置依赖 | 16-30 |
| **P0** | LangGraph Agent + Router | Playground 主路径 | 31-50 |
| **P0** | stream_service 集成 | 端到端可用 | 51-55 |
| **P1** | /api/playground/tools | 前端工具发现 | 56-58 |
| **P1** | pytest 契约测试 | 防 SSE 漂移 | 59-75 |
| **P2** | Wave2 脚手架 (rag/workflow/mcp) | 下阶段目录就绪 | 76-92 |
| **P2** | 脚本骨架 + 文档 | eval/chunk 批跑预留 | 93-100 |

---

## 100 Commit 清单

### §1 基线切换 (1-3)
1. `docs: add 100-commit iteration plan for python main branch`
2. `chore(server_py): default KRONOS_SERVER_RUNTIME to py in dev-server`
3. `chore: add test:py script and pytest.ini for server_py`

### §2 Guardrail (4-15)
4. `feat(guardrail): add package init`
5. `feat(guardrail): add config from env vars`
6. `feat(guardrail): add input check with empty and length rules`
7. `feat(guardrail): add output check with block patterns`
8. `test(guardrail): config enabled flag`
9. `test(guardrail): input empty prompt`
10. `test(guardrail): input max chars`
11. `test(guardrail): input block patterns`
12. `test(guardrail): output block patterns`
13. `feat(config): expose guardrail settings in Settings`
14. `feat(stream): wire input guardrail refusal path`
15. `feat(stream): wire output guardrail refusal path`

### §3 Tools (16-30)
16. `feat(tools): add package init`
17. `feat(tools): add tavily result formatter`
18. `feat(tools): add web_search tool via httpx`
19. `feat(tools): add registry builder`
20. `feat(tools): add agent system hint`
21. `feat(tools): add tool descriptors for API`
22. `test(tools): format empty tavily results`
23. `test(tools): format tavily results with snippets`
24. `test(tools): registry skips web_search without api key`
25. `test(tools): registry includes web_search with api key`
26. `test(tools): agent hint when web_search enabled`
27. `feat(requirements): add httpx for tavily calls`
28. `feat(config): wire TAVILY_API_KEY in settings`
29. `feat(routes): add GET /api/playground/tools`
30. `feat(main): register tools router`

### §4 Agent / LangGraph (31-50)
31. `feat(agent): add package init`
32. `feat(agent): add timeline event helper`
33. `feat(agent): add message text utilities`
34. `feat(agent): add tool stream mapper`
35. `feat(requirements): add langgraph and langchain-community`
36. `feat(agent): add langgraph react agent stream`
37. `feat(agent): add router with langgraph primary and linear fallback`
38. `test(agent): timeline event shape`
39. `test(agent): read message text from string content`
40. `test(agent): tool mapper emits tool start events`
41. `test(agent): tool mapper emits tool end events`
42. `test(agent): find current turn assistant text`
43. `test(agent): router uses linear when langgraph disabled`
44. `feat(stream): switch agent pipeline to router`
45. `feat(linear): pass session_id to langfuse in linear path`
46. `feat(chat_model): support max_tokens from degrade policy`
47. `feat(agent): apply recursion limit from settings`
48. `feat(agent): attach langfuse callbacks to langgraph`
49. `test(contract): sse data line json shape`
50. `test(contract): timeline stages plan reason tool`

### §5 契约与 CI (51-60)
51. `test(contract): complete event includes sessionId`
52. `test(contract): guardrail blocked yields timeline not content`
53. `feat(conftest): shared fixtures for guardrail and tools`
54. `chore: add pytest to verify script optional gate`
55. `docs: update CONTRIBUTING default python server`
56. `docs: update README python main branch note`
57. `docs: mark wave1 complete in 100-commit plan`
58. `chore(server_py): add py.typed marker`
59. `chore(server_py): add logging config for playground-chat`
60. `chore(package): rename dev:server:node script clarity`

### §6 Wave2 RAG 脚手架 (61-75)
61. `feat(rag): add package init`
62. `feat(rag): add retrieval types stub`
63. `feat(rag): add engine mode resolver stub`
64. `feat(rag): add facade entry stub`
65. `feat(rag): add eval metrics stub mirroring node`
66. `feat(rag): add chunking constants stub`
67. `test(rag): engine mode normalizes self/langchain`
68. `feat(rag): symlink data dir note in README`
69. `scripts: add run_rag_eval skeleton cli`
70. `scripts: add run_prompt_eval skeleton cli`
71. `scripts: add chunk_experiment skeleton cli`
72. `feat(rag): add contract assert helper stub`
73. `chore(rag): add requirements-rag.txt optional deps list`
74. `docs: wave2 rag migration checklist`
75. `test(rag): contract stub raises on missing keys`

### §7 Wave3 Workflow 脚手架 (76-88)
76. `feat(workflow): add package init`
77. `feat(workflow): add run status types stub`
78. `feat(workflow): add workflow fsm stub`
79. `feat(workflow): add node fsm stub`
80. `feat(workflow): add executors package init`
81. `feat(workflow): add llm executor stub`
82. `feat(workflow): add knowledge executor stub`
83. `feat(workflow): add draft runner stub`
84. `test(workflow): fsm terminal states stub`
85. `docs: wave3 workflow migration checklist`
86. `chore(workflow): note node executor parity matrix`
87. `feat(workflow): add sse event formatter stub`
88. `test(workflow): run summary shape stub`

### §8 Wave4 MCP + AI 基建脚手架 (89-100)
89. `feat(mcp): add package init`
90. `feat(mcp): add stdio server skeleton`
91. `feat(mcp): add knowledge_search tool stub`
92. `feat(mcp): add crawl_weibo tool stub`
93. `feat(ai): add package init`
94. `feat(ai): add gateway model resolver stub`
95. `feat(ai): add degrade policy stub`
96. `feat(ai): add token budget stub`
97. `test(ai): degrade tightens tool steps stub`
98. `docs: wave4 ai infra migration checklist`
99. `chore: add install:server-py to post-clone hint in README`
100. `chore: tag wave1 milestone in iteration plan`

---

## 验收（Wave 1 完成态）

- [ ] `pnpm dev` 默认启动 Python，`Playground` LangGraph + tool timeline 可见
- [ ] `GUARDRAIL_ENABLED=true` 时输入/输出拦截与 Node 一致
- [ ] `GET /api/playground/tools` 返回 web_search descriptor
- [ ] `pnpm test:py` 通过
- [ ] `feat/py` 推送至 origin
