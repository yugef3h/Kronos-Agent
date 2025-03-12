# Kronos Agent Architecture

## Vision

Build a frontend-first LLM systems playground where model internals and agent workflows are observable, testable, and configurable.

## Layers

1. Experience Layer (`apps/web`)
- Dashboard and visual debugging modules.
- Streaming chat timeline, sampling controls, and attention views.

2. Orchestration Layer (`apps/server`)
- SSE gateway.
- Session management.
- Future home for LangChain agent orchestration and tool routing.

3. Domain Layer (`packages/core`)
- Shared types.
- Sampling/math utilities.
- Future event schema for cross-app debugging.

## Module Map from Draft.md

- Token & Embedding Debugger -> `apps/web/src/features/tokenizer` (planned)
- Attention Visualization -> `apps/web/src/components/AttentionHeatmap.tsx`
- Sampling Debugger -> `apps/web/src/components/SamplingInspector.tsx`
- Long Context Memory -> `apps/server/src/domain` + LangChain Memory adapter (planned)
- Multi-Agent Comparison -> `apps/web/src/features/agents` + `apps/server/src/langchain` (planned)
- Tool Invocation Debugger -> `apps/server/src/langchain/tools` (planned)
- Stream Debugging -> `apps/web/src/components/ChatStreamPanel.tsx` + `apps/server/src/services/streamService.ts`

## Legacy Migration Strategy

Keep existing demo assets in place (`node`, `src`, `templates`) as reference implementations. Migrate feature-by-feature into the new architecture to avoid breaking working demos.
