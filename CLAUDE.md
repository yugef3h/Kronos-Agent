# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 1. Think Before Coding

**Don't assume. Surface tradeoffs. Verify before claiming.**

Before implementing:
- State assumptions explicitly. If uncertain, stop and ask.
- If multiple approaches exist, present the simplest one and justify.
- If something is unclear, name what's confusing — don't guess silently.

This is a **dual-runtime** project — two backends (Node/Python) share one frontend and one contract. When touching shared logic (memory orchestration, SSE events, session persistence), verify both sides are consistent.

## 2. Simplicity First

**Minimum code. No speculation.**

- No abstractions for single-use code.
- No "future-proofing" or configurability that wasn't requested.
- No error handling for impossible states.
- Python: follow existing module patterns — each domain is a flat package with `__init__.py` re-exporting public API.
- TypeScript: `strict: true`, no `any` without explicit justification.

## 3. Surgical Edits

**Touch only what you must. Match existing style.**

- Don't "clean up" adjacent code, comments, or formatting.
- Don't refactor unrelated files.
- Match surrounding naming, comment density, and import style — even if you'd do it differently.
- When your change creates orphans (unused imports, dead variables), remove only those you caused.
- Python: use `from __future__ import annotations` in every file (existing convention).

## 4. Goal-Driven Execution

**Define success. Loop until verified.**

```
pnpm verify:full    # lockfile + lint + Jest + build + pytest
```

For single tests:
```bash
pnpm jest --runInBand -- path/to/test.test.ts
apps/server_py/.venv/bin/pytest apps/server_py/tests/path/to/test.py -q
```

Before claiming "done": run the relevant test suite. Before committing: `pnpm verify` at minimum.

## 5. Dual-Runtime Constraints

**When changing shared behavior, both sides must agree.**

The Python backend (`apps/server_py/`) is the active refactor target on this branch. The Node backend (`apps/server/`) is the incumbent.

- **SSE contract**: frontend expects `timeline` / `content` / `complete` event types with `sessionId` + `eventId`. Changing the shape breaks the UI.
- **Session persistence**: defaults to file-based JSON (`data/sessions/`). Tests must pass without Redis. When `SESSION_STORE=redis`, a file mirror runs in parallel.
- **Memory orchestrator**: rolling summary + token budget. Must NOT call an LLM for summarization — it's a pure string algorithm. Identical logic in `apps/server_py/app/memory/orchestrator.py` and `apps/server/src/memory/`.
- **`.env`**: single file at `apps/.env`, read by both runtimes via pydantic-settings (`config.py`) or `dotenv`.
- **Python 3.9+**: use `Optional[str]` not `str | None`, `List[Foo]` not `list[Foo]`. The `from __future__ import annotations` import is required.

## 6. Quick Reference

```bash
pnpm dev                  # Frontend :5173 + Node server :3001
pnpm dev:server:py        # Frontend + Python server :3001
pnpm install:server-py    # Create venv + pip install
pnpm lint                 # eslint --max-warnings=0 (server + web)
pnpm test                 # Jest --runInBand
pnpm test:py              # pytest -q
pnpm build                # core → server → web
pnpm verify:full          # full CI gate
pnpm format               # Prettier
```

## 7. Architecture Map

```
apps/
  web/          @kronos/web       React 18 + Vite + Tailwind + Zustand + ReactFlow
  server/       @kronos/server    Node Express (TypeScript, tsx watch)
  server_py/    (Python)          FastAPI mirror — active refactor target
  crawler/      (Python)          Playwright crawler
  attention_py/ (Python)          Attention viz microservice (:8008)
packages/
  shared/       @kronos/shared    Shared types (stub)
```

### Python backend (`apps/server_py/app/`) — the call chain

```
routes/chat.py  →  services/stream_service.py  →  agent/router.py
                       ↑                              ├─ langgraph_stream.py  (Path B: ReAct + tools)
                       ├─ memory/orchestrator.py      └─ linear_chat_stream.py (Path A: fallback)
                       ├─ guardrail/ (input + output)
                       └─ domain/session/ (load/persist)
```

Other domains:
- `workflow/` — FSM draft runner + per-node executors (LLM, IfElse, Knowledge, Start, End)
- `rag/` — self-built retrieval: chunking → embedding → hybrid search → eval. `RAG_ENGINE_MODE=self|langchain`
- `tools/registry.py` — Tavily web_search, extensible tool registry
- `mcp/server.py` — MCP tool server
- `ai/gateway.py` — multi-model routing, cost tracking, load-based degradation
- `infra/` — Sentry, LangFuse, Redis, lifecycle signals

### Frontend routes

| Path | What |
|------|------|
| `/` | Playground chat + agent tools |
| `/workflow` | App list |
| `/workflow/draft?appId=` | ReactFlow canvas editor |
| `/workflow/config?appId=` | Chatbot prompt / RAG config |
| `/rag` | Knowledge base CRUD, chunks, eval |

### Key env vars (shared `apps/.env`)

| Var | Effect |
|-----|--------|
| `KRONOS_SERVER_RUNTIME` | `node` (default) or `py` |
| `DOUBAO_API_KEY/BASE_URL/MODEL` | Primary LLM (OpenAI-compatible) |
| `AI_PROVIDER/API_KEY/BASE_URL/MODEL` | Alternative LLM provider |
| `JWT_SECRET` | Required, min 16 chars |
| `SESSION_STORE` | `file` (default) or `redis` |
| `RAG_ENGINE_MODE` | `self` or `langchain` |
| `LANGGRAPH_ENABLED` | Agent mode toggle |
| `TAVILY_API_KEY` | Web search tool |
