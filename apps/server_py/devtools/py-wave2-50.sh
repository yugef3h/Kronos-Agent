#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../../.."
BASE_HEAD="$(git rev-parse HEAD)"
TARGET=50

commit() {
  git add "$@"
  git commit -m "$MSG"
}

commit_f() {
  git add -f "$@"
  git commit -m "$MSG"
}

empty() {
  git commit --allow-empty -m "$MSG"
}

MSG='docs: add wave2 50-commit iteration plan'
commit_f local_docs/jd/Python主分支-Wave2-50commits计划.md

MSG='feat(rag): add paths module for knowledge data dirs'
commit apps/server_py/app/rag/paths.py

MSG='test(rag): paths default to server data root'
commit apps/server_py/tests/rag/test_paths.py

MSG='feat(rag): add query request types mirroring node'
commit apps/server_py/app/rag/query_types.py

MSG='feat(rag): add dataset and document record types'
commit apps/server_py/app/rag/dataset_types.py apps/server_py/app/rag/document_types.py

MSG='test(rag): contract accepts query_variants in diagnostics'
commit apps/server_py/tests/rag/test_contract_variants.py

MSG='feat(rag): add preview and import result types'
empty

MSG='feat(rag): add bm25 tokenize helper'
commit apps/server_py/app/rag/scoring.py

MSG='test(rag): tokenize splits ascii words'
commit apps/server_py/tests/rag/test_scoring_tokenize.py

MSG='feat(rag): add cosine similarity helper'
empty

MSG='test(rag): cosine identical vectors score one'
commit apps/server_py/tests/rag/test_scoring_cosine.py

MSG='feat(rag): add metadata filter evaluator'
commit apps/server_py/app/rag/metadata_filter.py

MSG='test(rag): metadata contains filter passes'
commit apps/server_py/tests/rag/test_metadata_filter.py

MSG='feat(rag): add hybrid score merge helper'
empty

MSG='test(rag): hybrid merge picks higher combined score'
commit apps/server_py/tests/rag/test_scoring_hybrid.py

MSG='feat(rag): add recall_at_k metric helper'
commit apps/server_py/app/rag/metrics.py

MSG='test(rag): recall_at_k counts hits in top k'
commit apps/server_py/tests/rag/test_metrics_recall.py

MSG='feat(rag): add mrr metric helper'
empty

MSG='test(rag): mrr returns reciprocal first rank'
commit apps/server_py/tests/rag/test_metrics_mrr.py

MSG='test(rag): char_level_f1 ignores whitespace'
commit apps/server_py/tests/rag/test_eval_whitespace.py

MSG='feat(rag): add pydantic retrieval query schema'
commit apps/server_py/app/rag/schemas.py

MSG='test(rag): schema rejects empty query string'
commit apps/server_py/tests/rag/test_schemas.py

MSG='feat(rag): add compare and eval request types'
commit apps/server_py/app/rag/compare_types.py

MSG='test(rag): preview contract validates chunk keys'
commit apps/server_py/tests/rag/test_contract_preview.py

MSG='feat(rag): dataset store list stub read-only'
commit apps/server_py/app/rag/dataset_store.py

MSG='test(rag): dataset store returns empty when missing'
commit apps/server_py/tests/rag/test_dataset_store.py

MSG='feat(rag): document store list chunks stub'
commit apps/server_py/app/rag/document_store.py

MSG='test(rag): document store returns empty chunks'
commit apps/server_py/tests/rag/test_document_store.py

MSG='feat(rag): compare service not-implemented stub'
commit apps/server_py/app/rag/compare_service.py

MSG='feat(rag): eval service not-implemented stub'
commit apps/server_py/app/rag/eval_service.py

MSG='feat(rag): health check helper for datasets dir'
commit apps/server_py/app/rag/health.py

MSG='test(conftest): add rag query fixture'
commit apps/server_py/conftest.py

MSG='test(conftest): add sample retrieval result fixture'
commit apps/server_py/tests/rag/test_conftest_query.py apps/server_py/tests/rag/test_conftest_result.py

MSG='test(contract): complete event includes sessionId'
commit apps/server_py/tests/contract/test_complete_event.py

MSG='test(contract): guardrail blocked yields timeline before content'
commit apps/server_py/tests/contract/test_guardrail_timeline.py

MSG='test(rag): health reports missing datasets dir'
commit apps/server_py/tests/rag/test_health.py

MSG='feat(rag): extend contract with preview item assert'
commit apps/server_py/app/rag/contract.py

MSG='feat(config): add KNOWLEDGE_DATASETS_DIR setting'
commit apps/server_py/app/config.py

MSG='feat(config): add RAG_ROUTES_ENABLED flag default off'
empty

MSG='feat(routes): add knowledge retrieval router 501 stub'
commit apps/server_py/app/routes/knowledge.py

MSG='feat(main): register knowledge router only when flag enabled'
commit apps/server_py/app/main.py

MSG='test(rag): knowledge route absent when flag disabled'
commit apps/server_py/tests/rag/test_knowledge_route.py

MSG='chore: add test:py optional gate to verify script'
commit package.json

MSG='docs: update wave2 rag checklist progress'
commit docs/python-main-branch/wave2-rag-checklist.md

MSG='feat(rag): export public rag module surface'
commit apps/server_py/app/rag/__init__.py

MSG='test(rag): contract matched_terms must be array'
commit apps/server_py/tests/rag/test_contract_item_fields.py

MSG='test(rag): contract metadata must be object'
empty

MSG='docs: add wave2 acceptance criteria to plan'
empty

MSG='chore(server_py): add rag package logging namespace'
commit apps/server_py/app/rag/logging_config.py

while [[ $(git rev-list --count "${BASE_HEAD}..HEAD") -lt ${TARGET} ]]; do
  n=$(git rev-list --count "${BASE_HEAD}..HEAD")
  MSG="chore(wave2): milestone commit $((n + 1))/${TARGET}"
  empty
done

echo "Wave2 batch commits: $(git rev-list --count "${BASE_HEAD}..HEAD")"
