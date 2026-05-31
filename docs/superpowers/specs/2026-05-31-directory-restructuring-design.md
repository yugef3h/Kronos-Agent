# Directory Restructuring Design

**Date:** 2026-05-31
**Status:** Approved
**Scope:** Directory restructure + code reorganization (Option B)

## Motivation

The current monorepo has accumulated structural debt:

- 71 flat files in `services/`, 58 flat files in `workflow/` — no domain grouping
- `domain/` vs `models/` naming inconsistency with Dify conventions
- `routes/` vs `controllers/` naming inconsistency
- Root directory cluttered: configs, screenshots, HTML templates, docs mixed together
- `apps/apps/` nested empty directory (creation error)
- `local_docs/knowledge/` contains JS/TS code mixed with documentation
- `pnpm-workspace.yaml` declares `packages/*` and `tools/*` but neither exists
- `.pnpm-store/` committed at project root instead of using global store

## Target Structure

Inspired by Dify's "technical layer + domain grouping" hybrid approach.

```
Kronos-Agent/
├── apps/
│   ├── server/                     # @kronos/server (Node/TS)
│   │   └── src/
│   │       ├── index.ts
│   │       ├── core/               # Cross-cutting concerns
│   │       │   ├── config/         #   ← config/
│   │       │   ├── const/          #   ← const/
│   │       │   ├── types/          #   ← types/
│   │       │   └── utils/          #   ← utils/
│   │       ├── models/             # Domain models (← domain/)
│   │       │   ├── knowledge/
│   │       │   └── session/
│   │       ├── services/           # Business logic, grouped by domain
│   │       │   ├── chat/
│   │       │   ├── knowledge/
│   │       │   ├── attachment/
│   │       │   ├── file/
│   │       │   ├── agent/          #   ← existing
│   │       │   ├── image/
│   │       │   ├── hotTopic/
│   │       │   ├── auth/
│   │       │   └── workflow/       #   workflow engine + services
│   │       │       ├── engine/
│   │       │       ├── executors/
│   │       │       ├── runner/
│   │       │       ├── store/
│   │       │       ├── debug/
│   │       │       └── types/
│   │       ├── controllers/        # Route handlers (← routes/)
│   │       ├── middleware/
│   │       ├── ai/                 # AI infrastructure
│   │       │   ├── gateway/
│   │       │   ├── circuit/
│   │       │   ├── cache/
│   │       │   └── ...
│   │       ├── rag/                # RAG infrastructure
│   │       ├── memory/
│   │       ├── infra/
│   │       ├── rateLimit/
│   │       └── audit/
│   ├── server_py/                  # Python backend (unchanged)
│   ├── web/                        # @kronos/web
│   │   └── src/
│   │       ├── components/
│   │       ├── features/
│   │       ├── pages/
│   │       ├── domains/
│   │       ├── lib/
│   │       ├── store/
│   │       └── types/
│   └── attention_py/               # (unchanged)
│
├── packages/                       # Shared packages (new)
│   └── shared/                     # Shared TS types/utils
│
├── docs/                           # Unified docs (← local_docs/docs/)
│
├── .github/
├── scripts/
├── static/                         # Project assets
├── templates/                      # HTML templates (if still needed)
└── pnpm-workspace.yaml
```

## File Migration Map

### domain/ → models/
| Source | Target |
|--------|--------|
| `domain/` (all files) | `models/` |
| `domain/knowledge/` | `models/knowledge/` |
| `domain/session/` | `models/session/` |

### routes/ → controllers/
| Source | Target |
|--------|--------|
| `routes/` (all files) | `controllers/` |

### Cross-cutting → core/
| Source | Target |
|--------|--------|
| `config/` | `core/config/` |
| `const/` | `core/const/` |
| `types/` | `core/types/` |
| `utils/` | `core/utils/` |

### services/ flat files → domain subdirectories
| Source pattern | Target |
|---------------|--------|
| `services/doubaoChat*` (4 files) | `services/chat/` |
| `services/chat/*` (existing dir) | `services/chat/` |
| `services/knowledge*` (12+ files) | `services/knowledge/` |
| `services/attachment*` (3 files) | `services/attachment/` |
| `services/file*` (4 files) | `services/file/` |
| `services/document*` (1 file) | `services/file/` |
| `services/image*` (3 files) | `services/image/` |
| `services/imgbb*` (1 file) | `services/image/` |
| `services/hotTopic*` (3 files) | `services/hotTopic/` |
| `services/devToken*` (2 files) | `services/auth/` |
| `services/agent/` (existing dir) | `services/agent/` (keep) |

### workflow/ + services/workflow* → services/workflow/
| Source | Target |
|--------|--------|
| `services/workflowFsm*` | `services/workflow/engine/` |
| `services/workflowDsl*` | `services/workflow/engine/` |
| `services/buildExecutionGraph*` | `services/workflow/engine/` |
| `services/nodeFsm*` | `services/workflow/engine/` |
| `services/nodeExecutors*` | `services/workflow/executors/` |
| `services/registerNodeExecutors*` | `services/workflow/executors/` |
| `services/nodeDebugExecutors*` | `services/workflow/executors/` |
| `services/registerNodeDebugExecutors*` | `services/workflow/executors/` |
| `services/workflowDraftRunner*` | `services/workflow/runner/` |
| `services/executorBridge*` | `services/workflow/runner/` |
| `services/runContext*` | `services/workflow/runner/` |
| `services/workflowRunStore*` | `services/workflow/store/` |
| `services/workflowRunEvents*` | `services/workflow/store/` |
| `services/workflowRunCancellation*` | `services/workflow/store/` |
| `services/memoryWorkflow*` | `services/workflow/store/` |
| `services/createWorkflow*` | `services/workflow/store/` |
| `services/workflowDraftQueue*` | `services/workflow/runner/` |
| `services/nodeRunRecord*` | `services/workflow/engine/` |
| `services/workflowRunRecordPatch*` | `services/workflow/engine/` |
| `services/workflowRunSummary*` | `services/workflow/runner/` |
| `services/workflowRunEventTypes*` | `services/workflow/types/` |
| `services/types*` (workflow-related) | `services/workflow/types/` |
| `services/container/` (if exists) | `services/workflow/container/` |
| `workflow/` (remaining engine files) | `services/workflow/` |

Note: `workflow/` also has files like `workflowFsm.ts`, `buildExecutionGraph.ts` that overlap with `services/`. These will be deduplicated — keeping the canonical version in `services/workflow/`.

### Other moves
| Source | Target |
|--------|--------|
| `local_docs/docs/` | `docs/` |
| `local_docs/knowledge/*.js` | `packages/shared/src/` (re-evaluate per file) |
| `local_docs/knowledge/*.ts` | `packages/shared/src/` (re-evaluate per file) |
| `apps/apps/` | DELETE |

## Cleanup Items

1. **Delete `apps/apps/`** — nested empty directory from creation error
2. **Remove `.pnpm-store/`** — add to `.gitignore`, use global store
3. **Create `packages/shared/`** — with `package.json` (`@kronos/shared`), house shared TS types
4. **Root config files** — keep in place (standard monorepo pattern), no flattening needed
5. **`.agents/skills/`** — keep in place (Claude Code convention)

## Constraints

- **No logic changes** — pure file moves and import path updates
- **Tests must pass** — after each phase, `pnpm test` must be green
- **Build must pass** — `pnpm build` must succeed
- **Import paths** — all `import` statements updated to reflect new paths
- **barrel exports** — each new subdirectory gets an `index.ts` re-exporting its contents

## Implementation Phases

1. **Cleanup** — delete `apps/apps/`, remove `.pnpm-store/`, create `packages/shared/`
2. **Core consolidation** — move `config/`, `const/`, `types/`, `utils/` into `core/`
3. **Models rename** — `domain/` → `models/`
4. **Controllers rename** — `routes/` → `controllers/`
5. **Services regrouping** — sort flat files into domain subdirectories
6. **Workflow merge** — merge `workflow/` + `services/workflow*` into `services/workflow/`
7. **Documentation** — move `local_docs/docs/` → `docs/`, handle `knowledge/` code files
8. **Verify** — `pnpm test`, `pnpm build`, `pnpm lint` all green
