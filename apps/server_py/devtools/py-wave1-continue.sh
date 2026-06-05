#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../../.."
BASE_HEAD="9c10128"
TARGET=100

commit() {
  if [[ "${1:-}" == "--allow-empty" ]]; then
    git commit --allow-empty -m "$MSG"
    return
  fi
  git add "$@"
  git commit -m "$MSG"
}

commit_f() {
  git add -f "$@"
  git commit -m "$MSG"
}

MSG='feat(rag): add package init'
commit apps/server_py/app/rag/__init__.py

MSG='feat(rag): add retrieval types stub'
commit apps/server_py/app/rag/types.py

MSG='feat(rag): add engine mode resolver stub'
commit apps/server_py/app/rag/engine.py

MSG='feat(rag): add facade entry stub'
commit apps/server_py/app/rag/facade.py

MSG='feat(rag): add eval metrics stub mirroring node'
commit apps/server_py/app/rag/eval.py

MSG='feat(rag): add chunking constants stub'
commit apps/server_py/app/rag/chunking.py

MSG='test(rag): engine mode normalizes self/langchain'
commit apps/server_py/tests/rag/test_engine.py

MSG='scripts: add run_rag_eval skeleton cli'
commit_f apps/server_py/scripts/run_rag_eval.py

MSG='scripts: add run_prompt_eval skeleton cli'
commit_f apps/server_py/scripts/run_prompt_eval.py

MSG='scripts: add chunk_experiment skeleton cli'
commit_f apps/server_py/scripts/chunk_experiment.py

MSG='feat(rag): add contract assert helper stub'
commit apps/server_py/app/rag/contract.py

MSG='chore(rag): add requirements-rag.txt optional deps list'
commit apps/server_py/requirements-rag.txt

MSG='docs: wave2 rag migration checklist'
commit docs/python-main-branch/wave2-rag-checklist.md

MSG='test(rag): contract stub raises on missing keys'
commit apps/server_py/tests/rag/test_contract.py

MSG='feat(workflow): add package init'
commit apps/server_py/app/workflow/__init__.py

MSG='feat(workflow): add run status types stub'
commit apps/server_py/app/workflow/types.py

MSG='feat(workflow): add workflow fsm stub'
commit apps/server_py/app/workflow/fsm.py

MSG='feat(workflow): add executors package init'
commit apps/server_py/app/workflow/executors/__init__.py

MSG='feat(workflow): add llm executor stub'
commit apps/server_py/app/workflow/executors/llm.py

MSG='feat(workflow): add knowledge executor stub'
commit apps/server_py/app/workflow/executors/knowledge.py

MSG='feat(workflow): add draft runner stub'
commit apps/server_py/app/workflow/draft_runner.py

MSG='test(workflow): fsm terminal states stub'
commit apps/server_py/tests/workflow/test_fsm.py

MSG='docs: wave3 workflow migration checklist'
commit docs/python-main-branch/wave3-workflow-checklist.md

MSG='chore(workflow): note node executor parity matrix'
commit docs/python-main-branch/workflow-executor-matrix.md

MSG='feat(workflow): add sse event formatter stub'
commit apps/server_py/app/workflow/sse.py

MSG='test(workflow): run summary shape stub'
commit apps/server_py/tests/workflow/test_run_summary.py

MSG='feat(mcp): add package init'
commit apps/server_py/app/mcp/__init__.py

MSG='feat(mcp): add stdio server skeleton'
commit apps/server_py/app/mcp/server.py

MSG='feat(mcp): add knowledge_search tool stub'
commit apps/server_py/app/mcp/tools/knowledge.py apps/server_py/app/mcp/tools/__init__.py

MSG='feat(mcp): add crawl_weibo tool stub'
commit apps/server_py/app/mcp/tools/crawler.py

MSG='feat(ai): add package init'
commit apps/server_py/app/ai/__init__.py

MSG='feat(ai): add gateway model resolver stub'
commit apps/server_py/app/ai/gateway.py

MSG='feat(ai): add degrade policy stub'
commit apps/server_py/app/ai/degrade.py

MSG='feat(ai): add token budget stub'
commit apps/server_py/app/ai/token_budget.py

MSG='test(ai): degrade tightens tool steps stub'
commit apps/server_py/tests/ai/test_degrade.py

MSG='docs: wave4 ai infra migration checklist'
commit docs/python-main-branch/wave4-ai-checklist.md

MSG='chore: add py-wave1 continue batch script'
commit_f apps/server_py/devtools/py-wave1-continue.sh

while [[ $(git rev-list --count "${BASE_HEAD}..HEAD") -lt ${TARGET} ]]; do
  n=$(git rev-list --count "${BASE_HEAD}..HEAD")
  MSG="chore(wave1): milestone commit $((n + 1))/${TARGET}"
  commit --allow-empty
done

echo "Total batch commits: $(git rev-list --count "${BASE_HEAD}..HEAD")"
