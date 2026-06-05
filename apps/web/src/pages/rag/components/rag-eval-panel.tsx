import { useCallback, useMemo, useState } from 'react';

import { ensureKnowledgeDatasetAuthToken } from '../../../domains/knowledge/dataset-store';
import {
  requestKnowledgeRetrievalCompare,
  requestKnowledgeRetrievalEvaluate,
} from '../../../lib/api/knowledge';
import type {
  KnowledgeRetrievalEvalResponse,
  KnowledgeRetrievalCompareResponse,
} from '../../../lib/api/types/knowledge';
import type { KnowledgeDatasetDetail } from '../../../domains/knowledge/types';
import {
  buildDefaultEvalCases,
  buildDefaultEvalSharedInput,
  buildRetrievalQueryInput,
  formatEvalMetric,
  parseEvalCasesJson,
} from './rag-eval-utils';

type RagEvalPanelProps = {
  datasets: KnowledgeDatasetDetail[];
  selectedDatasetId: string;
  onSelectDataset: (datasetId: string) => void;
};

const DEFAULT_CASES_JSON = JSON.stringify(buildDefaultEvalCases(), null, 2);

export const RagEvalPanel = ({
  datasets,
  selectedDatasetId,
  onSelectDataset,
}: RagEvalPanelProps) => {
  const [casesJson, setCasesJson] = useState(DEFAULT_CASES_JSON);
  const [topK, setTopK] = useState(5);
  const [isRunning, setIsRunning] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [evalResult, setEvalResult] = useState<KnowledgeRetrievalEvalResponse | null>(null);
  const [compareResult, setCompareResult] = useState<KnowledgeRetrievalCompareResponse | null>(null);
  const [mode, setMode] = useState<'evaluate' | 'compare'>('evaluate');

  const selectedDataset = useMemo(
    () => datasets.find((item) => item.id === selectedDatasetId) ?? null,
    [datasets, selectedDatasetId],
  );

  const runEvaluate = useCallback(async () => {
    if (!selectedDatasetId) {
      setErrorMessage('请先选择知识库');
      return;
    }

    const authToken = await ensureKnowledgeDatasetAuthToken();
    if (!authToken) {
      setErrorMessage('评测需要 JWT 鉴权');
      return;
    }

    setIsRunning(true);
    setErrorMessage('');
    setEvalResult(null);
    setCompareResult(null);

    try {
      const cases = parseEvalCasesJson(casesJson);
      const shared = buildDefaultEvalSharedInput([selectedDatasetId]);
      shared.multiple_retrieval_config.top_k = topK;

      if (mode === 'evaluate') {
        const result = await requestKnowledgeRetrievalEvaluate({
          authToken,
          input: { shared, cases },
        });
        setEvalResult(result);
        return;
      }

      const query = cases[0]?.query;
      if (!query) {
        throw new Error('对比模式至少需要 1 条用例');
      }

      const retrievalA = buildRetrievalQueryInput(shared, query);
      const retrievalB = buildRetrievalQueryInput(
        {
          ...shared,
          multiple_retrieval_config: {
            ...shared.multiple_retrieval_config,
            top_k: Math.max(1, topK - 1),
          },
        },
        query,
      );

      const result = await requestKnowledgeRetrievalCompare({
        authToken,
        input: { retrieval_a: retrievalA, retrieval_b: retrievalB },
      });
      setCompareResult(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : '评测失败';
      setErrorMessage(message);
    } finally {
      setIsRunning(false);
    }
  }, [casesJson, mode, selectedDatasetId, topK]);

  if (datasets.length === 0) {
    return null;
  }

  return (
    <section className="mt-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">检索评测</h4>
          <p className="mt-1 text-xs text-slate-500">离线 Recall / MRR / EM，或对比两套 Top K 配置</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => setMode('evaluate')}
            className={`rounded-full px-3 py-1 ${mode === 'evaluate' ? 'bg-cyan-100 text-cyan-800' : 'bg-slate-100 text-slate-600'}`}
          >
            批量评测
          </button>
          <button
            type="button"
            onClick={() => setMode('compare')}
            className={`rounded-full px-3 py-1 ${mode === 'compare' ? 'bg-cyan-100 text-cyan-800' : 'bg-slate-100 text-slate-600'}`}
          >
            A/B 对比
          </button>
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_120px_auto]">
        <label className="block text-xs text-slate-600">
          知识库
          <select
            value={selectedDatasetId}
            onChange={(event) => onSelectDataset(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-800"
          >
            <option value="">选择知识库</option>
            {datasets.map((dataset) => (
              <option key={dataset.id} value={dataset.id}>{dataset.name}</option>
            ))}
          </select>
        </label>

        <label className="block text-xs text-slate-600">
          Top K
          <input
            type="number"
            min={1}
            max={20}
            value={topK}
            onChange={(event) => setTopK(Number(event.target.value) || 5)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-800"
          />
        </label>

        <button
          type="button"
          disabled={isRunning || !selectedDataset}
          onClick={() => {
            void runEvaluate();
          }}
          className="self-end rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isRunning ? '运行中…' : mode === 'evaluate' ? '运行评测' : '运行对比'}
        </button>
      </div>

      {mode === 'evaluate' ? (
        <label className="mt-3 block text-xs text-slate-600">
          用例 JSON（数组，每项含 query / gold_chunk_ids / expected_answer）
          <textarea
            value={casesJson}
            onChange={(event) => setCasesJson(event.target.value)}
            rows={5}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs text-slate-800"
          />
        </label>
      ) : (
        <p className="mt-3 text-xs text-slate-500">
          对比模式使用用例 JSON 第一条 query，A 为 Top K={topK}，B 为 Top K={Math.max(1, topK - 1)}。
        </p>
      )}

      {errorMessage ? (
        <p className="mt-3 text-sm text-rose-600">{errorMessage}</p>
      ) : null}

      {evalResult ? (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-xs text-slate-700">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-3">指标</th>
                <th className="py-2 pr-3">值</th>
              </tr>
            </thead>
            <tbody>
              <tr><td className="py-1 pr-3">样本数</td><td>{evalResult.summary.sample_count}</td></tr>
              <tr><td className="py-1 pr-3">Recall@K</td><td>{formatEvalMetric(evalResult.summary.recall_at_k)}</td></tr>
              <tr><td className="py-1 pr-3">MRR</td><td>{formatEvalMetric(evalResult.summary.mrr)}</td></tr>
              <tr><td className="py-1 pr-3">EM</td><td>{formatEvalMetric(evalResult.summary.em)}</td></tr>
              <tr><td className="py-1 pr-3">F1</td><td>{formatEvalMetric(evalResult.summary.f1)}</td></tr>
            </tbody>
          </table>

          <table className="mt-4 min-w-full text-left text-xs text-slate-700">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-3">Query</th>
                <th className="py-2 pr-3">Recall</th>
                <th className="py-2 pr-3">MRR</th>
                <th className="py-2 pr-3">EM</th>
              </tr>
            </thead>
            <tbody>
              {evalResult.cases.map((item) => (
                <tr key={item.query} className="border-b border-slate-100">
                  <td className="max-w-xs truncate py-2 pr-3">{item.query}</td>
                  <td className="py-2 pr-3">{formatEvalMetric(item.recall_at_k)}</td>
                  <td className="py-2 pr-3">{formatEvalMetric(item.mrr)}</td>
                  <td className="py-2 pr-3">{formatEvalMetric(item.em)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {compareResult ? (
        <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-xs text-slate-700">
          <p>Query: {compareResult.query}</p>
          <p className="mt-1">A latency: {compareResult.a.latencyMs}ms · B latency: {compareResult.b.latencyMs}ms</p>
          <p className="mt-1">
            TopK 重叠 Jaccard: {formatEvalMetric(compareResult.overlapTopK.jaccardChunkIds)}
            {' '}
            · 共同 chunk: {compareResult.overlapTopK.chunkIdsInBoth}
          </p>
        </div>
      ) : null}
    </section>
  );
};
