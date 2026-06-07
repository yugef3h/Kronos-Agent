# Kronos Python Service — Capability Matrix

> Auto-generated from Wave 3+4 implementation. Branch: `feat/py-2`

## Summary

| Domain | Status | Tests | Key Modules |
|--------|--------|-------|-------------|
| **Guardrail** | ✅ Complete | 9 tests | PII detection, sensitive words, rule profiles (strict/dev/off) |
| **Agent/LangGraph** | ✅ Complete | 4 tests | ReAct agent stream, tool mapper, router with fallback |
| **Tools** | ✅ Complete | 5 tests | Tavily web_search, tool registry, agent hints |
| **RAG Retrieval** | ✅ Complete | 20+ tests | BM25, hybrid search, facade, dataset/document stores, eval/compare |
| **RAG Eval** | ✅ Complete | Rec/MRR/EM/F1 | Batch eval service, compare service, contract assertions |
| **Workflow FSM** | ✅ Complete | 7+ tests | State machines, node transitions, graph types, run summaries |
| **Workflow Executors** | ✅ Complete | 4 tests | Start, End, LLM (streaming), Knowledge (RAG), IfElse (branching) |
| **Workflow Runner** | ✅ Complete | SSE draft runner | Topological node execution, branch routing, error propagation |
| **AI Gateway** | ✅ Complete | 5 tests | Intent routing, model tiers, fallback chains, health reporting |
| **Token Budget** | ✅ Complete | 5+ tests | Per-session tracking, exhaustion, TTL reset, stale cleanup |
| **Cost Estimation** | ✅ Complete | Integrated | Per-model pricing, text/message token counting |
| **MCP Server** | ✅ Complete | 4 tests | JSON-RPC stdio, knowledge_search, crawl_weibo, dataset manifest |
| **Embedding Cache** | ✅ Complete | Pickle cache | SHA256 keys, batch load, stats, clear |
| **Observability** | ✅ Complete | Structured JSON logging, component health checks, request middleware |
| **Lifecycle** | ✅ Complete | Signal handlers, shutdown hooks, cleanup tasks |

## Test Coverage

```
127 passed, 5 skipped in 0.76s
```

Test modules: 39 test files across agent, ai, contract, guardrail, mcp, rag, tools, workflow domains.

## Key Design Decisions

1. **No new external services** — all features use local files, pickle cache, or existing APIs
2. **Contract-first** — SSE events, retrieval items align with Node `knowledgeRagApiContract`
3. **Graceful degradation** — missing datasets return empty `[]`, not exceptions
4. **Profile-based guardrail** — strict/dev/off profiles with configurable PII and sensitive word checks
5. **Lazy executor loading** — workflow executors loaded on first use to avoid circular imports
6. **Token budget in-memory** — per-session tracking with TTL-based reset, no Redis dependency
