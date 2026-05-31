# Directory Restructuring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize `apps/server/src/` from flat service/workflow directories into Dify-style "technical layer + domain grouping" structure, plus root-level cleanup.

**Architecture:** Pure file moves + import path updates. No logic changes. Each phase groups related moves together, updates all affected imports, then verifies with `tsc --noEmit` before committing. Relative import paths recalculated based on new file depths.

**Tech Stack:** TypeScript, pnpm monorepo, Jest, ESLint

---

## Phase 1: Setup & Cleanup

### Task 1.1: Create feature branch

- [ ] **Step 1: Create and switch to feature branch**

```bash
git checkout -b refactor/directory-restructuring
```

- [ ] **Step 2: Verify on correct branch**

```bash
git branch --show-current
```

Expected: `refactor/directory-restructuring`

### Task 1.2: Delete nested error directory

- [ ] **Step 1: Remove apps/apps/**

```bash
rm -rf apps/apps
```

- [ ] **Step 2: Verify removal**

```bash
ls apps/apps 2>&1
```

Expected: `No such file or directory`

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "chore: remove nested apps/apps directory"
```

### Task 1.3: Add .pnpm-store to .gitignore

- [ ] **Step 1: Read current .gitignore**

```bash
cat .gitignore
```

- [ ] **Step 2: Append .pnpm-store/ if not present**

```bash
echo '.pnpm-store/' >> .gitignore
```

- [ ] **Step 3: Remove from git tracking**

```bash
git rm -r --cached .pnpm-store/
```

- [ ] **Step 4: Commit**

```bash
git add .gitignore && git commit -m "chore: move .pnpm-store out of project"
```

---

## Phase 2: Create packages/shared/

### Task 2.1: Scaffold shared package

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p packages/shared/src
```

- [ ] **Step 2: Create packages/shared/package.json**

Write `packages/shared/package.json`:
```json
{
  "name": "@kronos/shared",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "lint": "eslint \"src/**/*.ts\" --max-warnings=0"
  }
}
```

- [ ] **Step 3: Create barrel export**

Write `packages/shared/src/index.ts`:
```typescript
// @kronos/shared — shared types and utilities across server & web
export {};
```

- [ ] **Step 4: Move knowledge code from local_docs**

```bash
cp local_docs/knowledge/ScaledDotProductAttention.js packages/shared/src/
cp local_docs/knowledge/whats_mcp.ts packages/shared/src/
```

- [ ] **Step 5: Verify package is discoverable by pnpm**

```bash
pnpm list --filter @kronos/shared 2>&1 || echo "Need to run pnpm install"
```

Expected: lists `@kronos/shared` (may need `pnpm install` first)

- [ ] **Step 6: Commit**

```bash
git add packages/ && git commit -m "feat: scaffold @kronos/shared package"
```

---

## Phase 3: core/ Consolidation

Move `config/`, `const/`, `types/`, `utils/` into `core/`.

### Task 3.1: Create core/ directories and move files

- [ ] **Step 1: Create target directories**

```bash
mkdir -p apps/server/src/core
```

- [ ] **Step 2: Move config/**

```bash
mv apps/server/src/config apps/server/src/core/config
```

- [ ] **Step 3: Move const/**

```bash
mv apps/server/src/const apps/server/src/core/const
```

- [ ] **Step 4: Move types/**

```bash
mv apps/server/src/types apps/server/src/core/types
```

- [ ] **Step 5: Move utils/**

```bash
mv apps/server/src/utils apps/server/src/core/utils
```

### Task 3.2: Update imports that referenced config/

Files at `src/foo/bar.ts` with `../config/env.js` → `../core/config/env.js`. Use sed to update all imports.

- [ ] **Step 1: Update all config/ import paths**

```bash
find apps/server/src -name '*.ts' -not -path '*/node_modules/*' -not -path '*/dist/*' -exec sed -i '' "s|from '\.\./config/|from '../../core/config/|g; s|from \"\.\./config/|from \"../../core/config/|g; s|from '\./config/|from './core/config/|g; s|from \"\./config/|from \"./core/config/|g" {} +
```

- [ ] **Step 2: Update all const/ import paths**

```bash
find apps/server/src -name '*.ts' -not -path '*/node_modules/*' -not -path '*/dist/*' -exec sed -i '' "s|from '\.\./const/|from '../../core/const/|g; s|from \"\.\./const/|from \"../../core/const/|g; s|from '\./const/|from './core/const/|g; s|from \"\./const/|from \"./core/const/|g" {} +
```

- [ ] **Step 3: Update all types/ import paths**

```bash
find apps/server/src -name '*.ts' -not -path '*/node_modules/*' -not -path '*/dist/*' -exec sed -i '' "s|from '\.\./types/|from '../../core/types/|g; s|from \"\.\./types/|from \"../../core/types/|g; s|from '\./types/|from './core/types/|g; s|from \"\./types/|from \"./core/types/|g" {} +
```

- [ ] **Step 4: Update all utils/ import paths**

```bash
find apps/server/src -name '*.ts' -not -path '*/node_modules/*' -not -path '*/dist/*' -exec sed -i '' "s|from '\.\./utils/|from '../../core/utils/|g; s|from \"\.\./utils/|from \"../../core/utils/|g; s|from '\./utils/|from './core/utils/|g; s|from \"\./utils/|from \"./core/utils/|g" {} +
```

- [ ] **Step 5: Note — sed may miss edge cases with different relative depths. Verify next.**

### Task 3.3: Verify with tsc

- [ ] **Step 1: Run TypeScript compiler to find broken imports**

```bash
cd apps/server && npx tsc --noEmit 2>&1 | head -50
```

- [ ] **Step 2: Fix any remaining broken imports**

Manually fix any `Cannot find module` errors from tsc output. Common patterns:
- Triple-deep files: `from '../../../config/...'` → `from '../../../core/config/...'`
- Files inside config/ referencing each other: `from './env'` (unchanged, same dir)

- [ ] **Step 3: Re-run tsc until clean**

```bash
cd apps/server && npx tsc --noEmit
```

Expected: No errors.

### Task 3.4: Run tests

- [ ] **Step 1: Run full test suite**

```bash
pnpm test --runInBand
```

Expected: All tests pass (same as before restructuring).

- [ ] **Step 2: If any test fails with import errors, fix and re-run**

### Task 3.5: Commit

```bash
git add -A && git commit -m "refactor: consolidate config/const/types/utils into core/"
```

---

## Phase 4: models/ Rename (domain/ → models/)

### Task 4.1: Rename domain/ → models/

- [ ] **Step 1: Rename directory**

```bash
mv apps/server/src/domain apps/server/src/models
```

### Task 4.2: Update all imports

- [ ] **Step 1: Replace ../domain/ → ../models/ and ./domain/ → ./models/**

```bash
find apps/server/src -name '*.ts' -not -path '*/node_modules/*' -not -path '*/dist/*' -exec sed -i '' "s|from '\.\./domain/|from '../models/|g; s|from \"\.\./domain/|from \"../models/|g; s|from '\./domain/|from './models/|g; s|from \"\./domain/|from \"./models/|g" {} +
```

- [ ] **Step 2: Also check web/ for cross-app domain imports**

```bash
grep -r "domain/" apps/web/src/ --include="*.ts" --include="*.tsx" | grep -v node_modules
```

Note: `apps/web/src/domains/` is a separate web concept, NOT `apps/server/src/domain/`. Do NOT rename web/domains/.

### Task 4.3: Verify with tsc and tests

- [ ] **Step 1: tsc check**

```bash
cd apps/server && npx tsc --noEmit
```

- [ ] **Step 2: Run tests**

```bash
pnpm test --runInBand
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "refactor: rename domain/ to models/"
```

---

## Phase 5: Services Regrouping

Sort flat files in `services/` into domain subdirectories.

### Task 5.1: Create domain subdirectories

- [ ] **Step 1: Create all target directories**

```bash
mkdir -p apps/server/src/services/chat
mkdir -p apps/server/src/services/knowledge
mkdir -p apps/server/src/services/attachment
mkdir -p apps/server/src/services/file
mkdir -p apps/server/src/services/image
mkdir -p apps/server/src/services/hotTopic
mkdir -p apps/server/src/services/auth
```

### Task 5.2: Move chat files

Files to move: `doubaoChatHelpers.ts`, `doubaoChatHelpers.test.ts`, `fileAnalysisHelpers.ts`

- [ ] **Step 1: Move files**

```bash
mv apps/server/src/services/doubaoChatHelpers.ts apps/server/src/services/chat/
mv apps/server/src/services/doubaoChatHelpers.test.ts apps/server/src/services/chat/
mv apps/server/src/services/fileAnalysisHelpers.ts apps/server/src/services/chat/
```

- [ ] **Step 2: Update imports in moved files that reference each other**

```bash
# Within chat/ directory, files that referenced ./doubaoChatHelpers now still use ./ (same dir)
# No changes needed for intra-directory imports
```

- [ ] **Step 3: Update consumers importing these files**

```bash
# Files importing ../services/doubaoChatHelpers → ../services/chat/doubaoChatHelpers
find apps/server/src -name '*.ts' -not -path '*/node_modules/*' -not -path '*/dist/*' -exec sed -i '' "s|from '\.\./services/doubaoChatHelpers|from '../services/chat/doubaoChatHelpers|g; s|from \"\.\./services/doubaoChatHelpers|from \"../services/chat/doubaoChatHelpers|g" {} +
find apps/server/src -name '*.ts' -not -path '*/node_modules/*' -not -path '*/dist/*' -exec sed -i '' "s|from '\./services/doubaoChatHelpers|from './services/chat/doubaoChatHelpers|g; s|from \"\./services/doubaoChatHelpers|from \"./services/chat/doubaoChatHelpers|g" {} +
find apps/server/src -name '*.ts' -not -path '*/node_modules/*' -not -path '*/dist/*' -exec sed -i '' "s|from '\.\./services/fileAnalysisHelpers|from '../services/chat/fileAnalysisHelpers|g; s|from \"\.\./services/fileAnalysisHelpers|from \"../services/chat/fileAnalysisHelpers|g" {} +
```

### Task 5.3: Move knowledge files

Files to move: all `services/knowledge*` files (~14 files including tests)

- [ ] **Step 1: Move knowledge service files**

```bash
mv apps/server/src/services/knowledgeChunkingService.ts apps/server/src/services/knowledge/
mv apps/server/src/services/knowledgeDatasetHealthService.ts apps/server/src/services/knowledge/
mv apps/server/src/services/knowledgeDatasetHealthService.test.ts apps/server/src/services/knowledge/
mv apps/server/src/services/knowledgeDatasetSnapshotService.ts apps/server/src/services/knowledge/
mv apps/server/src/services/knowledgeExampleStore.ts apps/server/src/services/knowledge/
mv apps/server/src/services/knowledgeImportPreprocessing.ts apps/server/src/services/knowledge/
mv apps/server/src/services/knowledgeIndexingEstimateService.ts apps/server/src/services/knowledge/
mv apps/server/src/services/knowledgeIndexingEstimateService.test.ts apps/server/src/services/knowledge/
mv apps/server/src/services/knowledgeKeywordService.test.ts apps/server/src/services/knowledge/ 2>/dev/null || true
mv apps/server/src/services/knowledgeRetrievalService.ts apps/server/src/services/knowledge/ 2>/dev/null || true
```

- [ ] **Step 2: Check for any remaining knowledge* files**

```bash
ls apps/server/src/services/knowledge*.ts 2>/dev/null
```

Move any remaining files into `services/knowledge/`.

- [ ] **Step 3: Update consumer imports**

```bash
# Replace ../services/knowledge* → ../services/knowledge/knowledge*
find apps/server/src -name '*.ts' -not -path '*/node_modules/*' -not -path '*/dist/*' -exec sed -i '' "s|from '\.\./services/knowledgeChunkingService|from '../services/knowledge/knowledgeChunkingService|g; s|from \"\.\./services/knowledgeChunkingService|from \"../services/knowledge/knowledgeChunkingService|g" {} +
find apps/server/src -name '*.ts' -not -path '*/node_modules/*' -not -path '*/dist/*' -exec sed -i '' "s|from '\.\./services/knowledgeRetrievalService|from '../services/knowledge/knowledgeRetrievalService|g; s|from \"\.\./services/knowledgeRetrievalService|from \"../services/knowledge/knowledgeRetrievalService|g" {} +
find apps/server/src -name '*.ts' -not -path '*/node_modules/*' -not -path '*/dist/*' -exec sed -i '' "s|from '\.\./services/knowledgeImportPreprocessing|from '../services/knowledge/knowledgeImportPreprocessing|g; s|from \"\.\./services/knowledgeImportPreprocessing|from \"../services/knowledge/knowledgeImportPreprocessing|g" {} +
find apps/server/src -name '*.ts' -not -path '*/node_modules/*' -not -path '*/dist/*' -exec sed -i '' "s|from '\.\./services/knowledgeExampleStore|from '../services/knowledge/knowledgeExampleStore|g; s|from \"\.\./services/knowledgeExampleStore|from \"../services/knowledge/knowledgeExampleStore|g" {} +
find apps/server/src -name '*.ts' -not -path '*/node_modules/*' -not -path '*/dist/*' -exec sed -i '' "s|from '\.\./services/knowledgeIndexingEstimateService|from '../services/knowledge/knowledgeIndexingEstimateService|g; s|from \"\.\./services/knowledgeIndexingEstimateService|from \"../services/knowledge/knowledgeIndexingEstimateService|g" {} +
find apps/server/src -name '*.ts' -not -path '*/node_modules/*' -not -path '*/dist/*' -exec sed -i '' "s|from '\.\./services/knowledgeDatasetHealthService|from '../services/knowledge/knowledgeDatasetHealthService|g; s|from \"\.\./services/knowledgeDatasetHealthService|from \"../services/knowledge/knowledgeDatasetHealthService|g" {} +
```

- [ ] **Step 4: Also handle ./services/ (same-dir) imports**

```bash
# When importing from within services/ directory
find apps/server/src/services -name '*.ts' -exec sed -i '' "s|from '\./knowledgeChunkingService|from './knowledge/knowledgeChunkingService|g; s|from \"\./knowledgeChunkingService|from \"./knowledge/knowledgeChunkingService|g" {} +
find apps/server/src/services -name '*.ts' -exec sed -i '' "s|from '\./knowledgeRetrievalService|from './knowledge/knowledgeRetrievalService|g; s|from \"\./knowledgeRetrievalService|from \"./knowledge/knowledgeRetrievalService|g" {} +
find apps/server/src/services -name '*.ts' -exec sed -i '' "s|from '\./knowledgeImportPreprocessing|from './knowledge/knowledgeImportPreprocessing|g; s|from \"\./knowledgeImportPreprocessing|from \"./knowledge/knowledgeImportPreprocessing|g" {} +
find apps/server/src/services -name '*.ts' -exec sed -i '' "s|from '\./knowledgeExampleStore|from './knowledge/knowledgeExampleStore|g; s|from \"\./knowledgeExampleStore|from \"./knowledge/knowledgeExampleStore|g" {} +
find apps/server/src/services -name '*.ts' -exec sed -i '' "s|from '\./knowledgeIndexingEstimateService|from './knowledge/knowledgeIndexingEstimateService|g; s|from \"\./knowledgeIndexingEstimateService|from \"./knowledge/knowledgeIndexingEstimateService|g" {} +
```

### Task 5.4: Move attachment files

Files: `attachmentService.ts`, `attachmentSignedUrl.ts`, `attachmentSignedUrl.test.ts`

- [ ] **Step 1: Move files**

```bash
mv apps/server/src/services/attachmentService.ts apps/server/src/services/attachment/
mv apps/server/src/services/attachmentSignedUrl.ts apps/server/src/services/attachment/
mv apps/server/src/services/attachmentSignedUrl.test.ts apps/server/src/services/attachment/
```

- [ ] **Step 2: Update imports**

```bash
find apps/server/src -name '*.ts' -not -path '*/node_modules/*' -not -path '*/dist/*' -exec sed -i '' "s|from '\.\./services/attachmentService|from '../services/attachment/attachmentService|g; s|from \"\.\./services/attachmentService|from \"../services/attachment/attachmentService|g" {} +
find apps/server/src -name '*.ts' -not -path '*/node_modules/*' -not -path '*/dist/*' -exec sed -i '' "s|from '\.\./services/attachmentSignedUrl|from '../services/attachment/attachmentSignedUrl|g; s|from \"\.\./services/attachmentSignedUrl|from \"../services/attachment/attachmentSignedUrl|g" {} +
find apps/server/src -name '*.ts' -not -path '*/node_modules/*' -not -path '*/dist/*' -exec sed -i '' "s|from '\./services/attachmentService|from './services/attachment/attachmentService|g; s|from \"\./services/attachmentService|from \"./services/attachment/attachmentService|g" {} +
```

### Task 5.5: Move file-analysis files

Files: `fileAnalysisService.ts`, `fileAnalysisService.test.ts`, `documentTextExtractor.ts`

- [ ] **Step 1: Move files**

```bash
mv apps/server/src/services/fileAnalysisService.ts apps/server/src/services/file/
mv apps/server/src/services/fileAnalysisService.test.ts apps/server/src/services/file/
mv apps/server/src/services/documentTextExtractor.ts apps/server/src/services/file/
```

- [ ] **Step 2: Update imports**

```bash
find apps/server/src -name '*.ts' -not -path '*/node_modules/*' -not -path '*/dist/*' -exec sed -i '' "s|from '\.\./services/fileAnalysisService|from '../services/file/fileAnalysisService|g; s|from \"\.\./services/fileAnalysisService|from \"../services/file/fileAnalysisService|g" {} +
find apps/server/src -name '*.ts' -not -path '*/node_modules/*' -not -path '*/dist/*' -exec sed -i '' "s|from '\.\./services/documentTextExtractor|from '../services/file/documentTextExtractor|g; s|from \"\.\./services/documentTextExtractor|from \"../services/file/documentTextExtractor|g" {} +
find apps/server/src -name '*.ts' -not -path '*/node_modules/*' -not -path '*/dist/*' -exec sed -i '' "s|from '\./services/fileAnalysisService|from './services/file/fileAnalysisService|g; s|from \"\./services/fileAnalysisService|from \"./services/file/fileAnalysisService|g" {} +
```

### Task 5.6: Move image files

Files: `imageRecognitionService.ts`, `imageRecognitionService.test.ts`, `imgbbUploadService.ts`

- [ ] **Step 1: Move files**

```bash
mv apps/server/src/services/imageRecognitionService.ts apps/server/src/services/image/
mv apps/server/src/services/imageRecognitionService.test.ts apps/server/src/services/image/
mv apps/server/src/services/imgbbUploadService.ts apps/server/src/services/image/
```

- [ ] **Step 2: Update imports**

```bash
find apps/server/src -name '*.ts' -not -path '*/node_modules/*' -not -path '*/dist/*' -exec sed -i '' "s|from '\.\./services/imageRecognitionService|from '../services/image/imageRecognitionService|g; s|from \"\.\./services/imageRecognitionService|from \"../services/image/imageRecognitionService|g" {} +
find apps/server/src -name '*.ts' -not -path '*/node_modules/*' -not -path '*/dist/*' -exec sed -i '' "s|from '\.\./services/imgbbUploadService|from '../services/image/imgbbUploadService|g; s|from \"\.\./services/imgbbUploadService|from \"../services/image/imgbbUploadService|g" {} +
```

### Task 5.7: Move hotTopic files

Files: `hotTopicService.ts`, `hotTopicService.test.ts`

- [ ] **Step 1: Move files**

```bash
mv apps/server/src/services/hotTopicService.ts apps/server/src/services/hotTopic/
mv apps/server/src/services/hotTopicService.test.ts apps/server/src/services/hotTopic/
```

- [ ] **Step 2: Update imports**

```bash
find apps/server/src -name '*.ts' -not -path '*/node_modules/*' -not -path '*/dist/*' -exec sed -i '' "s|from '\.\./services/hotTopicService|from '../services/hotTopic/hotTopicService|g; s|from \"\.\./services/hotTopicService|from \"../services/hotTopic/hotTopicService|g" {} +
```

### Task 5.8: Move auth files

Files: `devTokenService.ts`, `devTokenService.test.ts`

- [ ] **Step 1: Move files**

```bash
mv apps/server/src/services/devTokenService.ts apps/server/src/services/auth/
mv apps/server/src/services/devTokenService.test.ts apps/server/src/services/auth/
```

- [ ] **Step 2: Update imports**

```bash
find apps/server/src -name '*.ts' -not -path '*/node_modules/*' -not -path '*/dist/*' -exec sed -i '' "s|from '\.\./services/devTokenService|from '../services/auth/devTokenService|g; s|from \"\.\./services/devTokenService|from \"../services/auth/devTokenService|g" {} +
find apps/server/src -name '*.ts' -not -path '*/node_modules/*' -not -path '*/dist/*' -exec sed -i '' "s|from '\./services/devTokenService|from './services/auth/devTokenService|g; s|from \"\./services/devTokenService|from \"./services/auth/devTokenService|g" {} +
```

### Task 5.9: Verify services regrouping

- [ ] **Step 1: tsc check**

```bash
cd apps/server && npx tsc --noEmit 2>&1 | head -80
```

- [ ] **Step 2: Fix any remaining import errors**

Check for patterns missed by sed:
```bash
grep -r "from.*services/knowledge[^/A-Za-z]" apps/server/src/ --include="*.ts" | grep -v node_modules
```

- [ ] **Step 3: Run tests**

```bash
pnpm test --runInBand
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "refactor: group services by domain (chat, knowledge, attachment, file, image, hotTopic, auth)"
```

---

## Phase 6: Workflow Merge

Merge `workflow/` (58 files) + `services/workflow*` (10 auxiliary files) into `services/workflow/` with subdirectories.

### Task 6.1: Create workflow subdirectories

- [ ] **Step 1: Create target structure**

```bash
mkdir -p apps/server/src/services/workflow/engine
mkdir -p apps/server/src/services/workflow/executors
mkdir -p apps/server/src/services/workflow/runner
mkdir -p apps/server/src/services/workflow/store
mkdir -p apps/server/src/services/workflow/debug
mkdir -p apps/server/src/services/workflow/types
mkdir -p apps/server/src/services/workflow/container
```

### Task 6.2: Move workflow engine core files

Files: `workflowFsm.ts`, `workflowDsl.ts`, `buildExecutionGraph.ts`, `nodeFsm.ts`, `nodeRunRecord.ts`, `types.ts` and their tests.

- [ ] **Step 1: Move engine files**

```bash
mv apps/server/src/workflow/workflowFsm.ts apps/server/src/services/workflow/engine/
mv apps/server/src/workflow/workflowFsm.test.ts apps/server/src/services/workflow/engine/
mv apps/server/src/workflow/workflowDsl.ts apps/server/src/services/workflow/engine/
mv apps/server/src/workflow/buildExecutionGraph.ts apps/server/src/services/workflow/engine/
mv apps/server/src/workflow/buildExecutionGraph.test.ts apps/server/src/services/workflow/engine/
mv apps/server/src/workflow/nodeFsm.ts apps/server/src/services/workflow/engine/
mv apps/server/src/workflow/nodeFsm.test.ts apps/server/src/services/workflow/engine/
mv apps/server/src/workflow/nodeRunRecord.ts apps/server/src/services/workflow/engine/
mv apps/server/src/workflow/types.ts apps/server/src/services/workflow/types/
mv apps/server/src/workflow/types.test.ts apps/server/src/services/workflow/types/
mv apps/server/src/workflow/workflowRunEventTypes.ts apps/server/src/services/workflow/types/
```

### Task 6.3: Move executor files

Files: `nodeExecutors.ts`, `registerNodeExecutors.ts`, `nodeDebugExecutors.ts`, `registerNodeDebugExecutors.ts` and tests.

- [ ] **Step 1: Move executor files**

```bash
mv apps/server/src/workflow/nodeExecutors.ts apps/server/src/services/workflow/executors/
mv apps/server/src/workflow/nodeExecutors.test.ts apps/server/src/services/workflow/executors/
mv apps/server/src/workflow/registerNodeExecutors.ts apps/server/src/services/workflow/executors/
mv apps/server/src/workflow/nodeDebugExecutors.ts apps/server/src/services/workflow/executors/
mv apps/server/src/workflow/nodeDebugExecutors.test.ts apps/server/src/services/workflow/executors/
mv apps/server/src/workflow/registerNodeDebugExecutors.ts apps/server/src/services/workflow/executors/
```

### Task 6.4: Move runner files

Files: `workflowDraftRunner.ts`, `executorBridge.ts`, `runContext.ts`, `workflowDraftQueue.ts`, `workflowRunSummary.ts` and tests.

- [ ] **Step 1: Move runner files**

```bash
mv apps/server/src/workflow/workflowDraftRunner.ts apps/server/src/services/workflow/runner/
mv apps/server/src/workflow/workflowDraftRunner.test.ts apps/server/src/services/workflow/runner/
mv apps/server/src/workflow/workflowDraftRunner.ifelse.test.ts apps/server/src/services/workflow/runner/
mv apps/server/src/workflow/workflowDraftRunner.iteration.test.ts apps/server/src/services/workflow/runner/
mv apps/server/src/workflow/workflowDraftRunner.knowledge.test.ts apps/server/src/services/workflow/runner/
mv apps/server/src/workflow/workflowDraftRunner.llm.test.ts apps/server/src/services/workflow/runner/
mv apps/server/src/workflow/workflowDraftRunner.loop.test.ts apps/server/src/services/workflow/runner/
mv apps/server/src/workflow/executorBridge.ts apps/server/src/services/workflow/runner/
mv apps/server/src/workflow/executorBridge.merge.test.ts apps/server/src/services/workflow/runner/
mv apps/server/src/workflow/runContext.ts apps/server/src/services/workflow/runner/
mv apps/server/src/workflow/runContext.test.ts apps/server/src/services/workflow/runner/
mv apps/server/src/workflow/workflowDraftQueue.ts apps/server/src/services/workflow/runner/
mv apps/server/src/workflow/workflowDraftQueueTypes.ts apps/server/src/services/workflow/runner/
mv apps/server/src/workflow/workflowRunSummary.ts apps/server/src/services/workflow/runner/
```

### Task 6.5: Move store files

Files: `workflowRunStore*.ts`, `workflowRunEvents*.ts`, `workflowRunCancellation*.ts`, `memoryWorkflow*.ts`, `redisWorkflow*.ts`, `createWorkflow*.ts`.

- [ ] **Step 1: Move store files**

```bash
mv apps/server/src/workflow/workflowRunStore.ts apps/server/src/services/workflow/store/
mv apps/server/src/workflow/workflowRunStore.test.ts apps/server/src/services/workflow/store/
mv apps/server/src/workflow/workflowRunStoreBackend.ts apps/server/src/services/workflow/store/
mv apps/server/src/workflow/workflowRunEvents.ts apps/server/src/services/workflow/store/
mv apps/server/src/workflow/workflowRunEvents.test.ts apps/server/src/services/workflow/store/
mv apps/server/src/workflow/workflowRunEventsBackend.ts apps/server/src/services/workflow/store/
mv apps/server/src/workflow/workflowRunCancellation.ts apps/server/src/services/workflow/store/
mv apps/server/src/workflow/workflowRunCancellation.test.ts apps/server/src/services/workflow/store/
mv apps/server/src/workflow/workflowRunCancellationBackend.ts apps/server/src/services/workflow/store/
mv apps/server/src/workflow/memoryWorkflowRunStore.ts apps/server/src/services/workflow/store/
mv apps/server/src/workflow/memoryWorkflowRunStoreAsync.ts apps/server/src/services/workflow/store/
mv apps/server/src/workflow/memoryWorkflowRunEvents.ts apps/server/src/services/workflow/store/
mv apps/server/src/workflow/memoryWorkflowRunCancellation.ts apps/server/src/services/workflow/store/
mv apps/server/src/workflow/redisWorkflowRunStore.ts apps/server/src/services/workflow/store/
mv apps/server/src/workflow/redisWorkflowRunEvents.ts apps/server/src/services/workflow/store/
mv apps/server/src/workflow/redisWorkflowRunCancellation.ts apps/server/src/services/workflow/store/
mv apps/server/src/workflow/createWorkflowRunStore.ts apps/server/src/services/workflow/store/
mv apps/server/src/workflow/createWorkflowRunEventsStore.ts apps/server/src/services/workflow/store/
mv apps/server/src/workflow/createWorkflowRunCancellationStore.ts apps/server/src/services/workflow/store/
mv apps/server/src/workflow/workflowRunRecordPatch.ts apps/server/src/services/workflow/store/
mv apps/server/src/workflow/workflowRunRecordPatch.test.ts apps/server/src/services/workflow/store/
```

### Task 6.6: Move debug and container

- [ ] **Step 1: Move debug directory**

```bash
mv apps/server/src/workflow/debug apps/server/src/services/workflow/debug/
```

Note: debug/ is a directory, need to handle correctly:
```bash
cp -r apps/server/src/workflow/debug/* apps/server/src/services/workflow/debug/
rm -rf apps/server/src/workflow/debug
```

- [ ] **Step 2: Move container directory**

```bash
mv apps/server/src/workflow/container apps/server/src/services/workflow/container/
```

Same approach:
```bash
cp -r apps/server/src/workflow/container/* apps/server/src/services/workflow/container/
rm -rf apps/server/src/workflow/container
```

### Task 6.7: Move auxiliary workflow services from services/

Files: `workflowExample*.ts`, `workflowKnowledge*.ts`, `workflowDraftPreview*.ts`, `langgraphWorkflowService.ts`

- [ ] **Step 1: Move into services/workflow/**

```bash
mv apps/server/src/services/workflowExampleKnowledgeSync.ts apps/server/src/services/workflow/
mv apps/server/src/services/workflowExampleKnowledgeSync.test.ts apps/server/src/services/workflow/
mv apps/server/src/services/workflowExampleSaveGuard.ts apps/server/src/services/workflow/
mv apps/server/src/services/workflowExampleSaveGuard.test.ts apps/server/src/services/workflow/
mv apps/server/src/services/workflowExampleStore.ts apps/server/src/services/workflow/
mv apps/server/src/services/workflowExampleStore.readonly.test.ts apps/server/src/services/workflow/
mv apps/server/src/services/workflowKnowledgeDependencies.ts apps/server/src/services/workflow/
mv apps/server/src/services/workflowKnowledgeDependencies.test.ts apps/server/src/services/workflow/
mv apps/server/src/services/workflowDraftPreviewDiskStore.ts apps/server/src/services/workflow/
mv apps/server/src/services/langgraphWorkflowService.ts apps/server/src/services/workflow/
```

### Task 6.8: Move remaining workflow/ files and remove old directory

- [ ] **Step 1: Move any remaining files**

```bash
# Move index.ts and any remaining files
ls apps/server/src/workflow/
```

- [ ] **Step 2: Move workflow/index.ts if it exists**

```bash
mv apps/server/src/workflow/index.ts apps/server/src/services/workflow/index.ts 2>/dev/null || true
```

- [ ] **Step 3: Remove empty workflow/ directory**

```bash
rmdir apps/server/src/workflow 2>/dev/null || rm -rf apps/server/src/workflow
```

### Task 6.9: Update all workflow import paths

This is the most complex import update. All `../workflow/` paths become `../services/workflow/<subdir>/` based on where each file landed.

- [ ] **Step 1: Update imports for files that referenced workflow/ from routes/**

```bash
# routes/ files: ../workflow/foo → ../services/workflow/<subdir>/foo
# Use tsc to find errors, then fix systematically
```

**Better approach**: Run tsc first to see all broken imports, then fix with targeted sed commands.

```bash
cd apps/server && npx tsc --noEmit 2>&1 | grep "Cannot find module" | sort -u
```

- [ ] **Step 2: Apply the known import path updates**

```bash
# From routes/ (depth: src/routes/ → src/services/workflow/ = ../../services/workflow/)
find apps/server/src -name '*.ts' -not -path '*/node_modules/*' -not -path '*/dist/*' -exec sed -i '' "s|from '\.\./workflow/|from '../services/workflow/|g; s|from \"\.\./workflow/|from \"../services/workflow/|g" {} +
find apps/server/src -name '*.ts' -not -path '*/node_modules/*' -not -path '*/dist/*' -exec sed -i '' "s|from '\./workflow/|from './services/workflow/|g; s|from \"\./workflow/|from \"./services/workflow/|g" {} +
```

- [ ] **Step 3: Update imports between moved workflow files** (intra-workflow references)

Files within `services/workflow/` that referenced each other via `./` or `../workflow/` need updated paths. Key patterns:
- `from './types.js'` → `from '../types/types.js'` (if moved from workflow/ to services/workflow/engine/)
- `from './buildExecutionGraph.js'` → `from '../engine/buildExecutionGraph.js'`

```bash
cd apps/server && npx tsc --noEmit 2>&1 | grep "Cannot find module" | head -50
```

Fix each error manually based on the actual new file locations.

### Task 6.10: Verify workflow merge

- [ ] **Step 1: tsc check**

```bash
cd apps/server && npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -60
```

- [ ] **Step 2: Fix remaining import errors iteratively**

For each `Cannot find module` error, determine the correct relative path and apply sed or fix manually.

- [ ] **Step 3: Run tests**

```bash
pnpm test --runInBand
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "refactor: merge workflow/ into services/workflow/ with subdirectories"
```

---

## Phase 7: Controllers Rename (routes/ → controllers/)

### Task 7.1: Rename routes/ → controllers/

- [ ] **Step 1: Rename directory**

```bash
mv apps/server/src/routes apps/server/src/controllers
```

### Task 7.2: Update imports

- [ ] **Step 1: Replace ../routes/ → ../controllers/ and ./routes/ → ./controllers/**

```bash
find apps/server/src -name '*.ts' -not -path '*/node_modules/*' -not -path '*/dist/*' -exec sed -i '' "s|from '\.\./routes/|from '../controllers/|g; s|from \"\.\./routes/|from \"../controllers/|g; s|from '\./routes/|from './controllers/|g; s|from \"\./routes/|from \"./controllers/|g" {} +
```

### Task 7.3: Verify

- [ ] **Step 1: tsc check**

```bash
cd apps/server && npx tsc --noEmit
```

- [ ] **Step 2: Run tests**

```bash
pnpm test --runInBand
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "refactor: rename routes/ to controllers/"
```

---

## Phase 8: Documentation Consolidation

### Task 8.1: Move docs to root level

- [ ] **Step 1: Create root docs/ if not exists**

```bash
# Already exists with superpowers specs
```

- [ ] **Step 2: Move local_docs/docs/ content to docs/**

```bash
cp -r local_docs/docs/* docs/
rm -rf local_docs/docs
```

- [ ] **Step 3: Handle local_docs/knowledge/ code files**

```bash
# Already handled in Phase 2 (copied to packages/shared/src/)
# Remove the local_docs/knowledge/ directory
rm -rf local_docs/knowledge
```

- [ ] **Step 4: Remove local_docs/ if empty**

```bash
rmdir local_docs 2>/dev/null || true
```

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "docs: consolidate documentation to root docs/"
```

---

## Phase 9: Final Verification

### Task 9.1: Full build and test

- [ ] **Step 1: Install dependencies (if packages changed)**

```bash
pnpm install
```

- [ ] **Step 2: Full TypeScript check**

```bash
cd apps/server && npx tsc --noEmit
```

Expected: Zero errors.

- [ ] **Step 3: Lint**

```bash
pnpm lint
```

Expected: Zero warnings.

- [ ] **Step 4: Full test suite**

```bash
pnpm test --runInBand
```

Expected: All tests pass.

- [ ] **Step 5: Full build**

```bash
pnpm build
```

Expected: Build succeeds.

### Task 9.2: Verify final structure

- [ ] **Step 1: Print final directory tree**

```bash
find apps/server/src -maxdepth 3 -type d | sort
```

Confirm structure matches target:
```
src/
├── core/
│   ├── config/
│   ├── const/
│   ├── types/
│   └── utils/
├── models/
│   ├── knowledge/
│   └── session/
├── services/
│   ├── agent/
│   ├── attachment/
│   ├── auth/
│   ├── chat/
│   ├── file/
│   ├── hotTopic/
│   ├── image/
│   ├── knowledge/
│   └── workflow/
│       ├── container/
│       ├── debug/
│       ├── engine/
│       ├── executors/
│       ├── runner/
│       ├── store/
│       └── types/
├── controllers/
├── middleware/
├── ai/
├── rag/
├── memory/
├── infra/
├── rateLimit/
└── audit/
```

- [ ] **Step 2: Commit final verification**

```bash
git add -A && git commit -m "chore: final verification after directory restructuring"
```

---

## Rollback Plan

If restructuring breaks something irrecoverably:
```bash
git checkout main  # or the original branch
```

Each phase is independently committed, so partial rollback is also possible by reverting specific commits.
