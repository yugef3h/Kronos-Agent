import { useMemo, useState } from 'react';
import { apiUrl } from '../lib/api';
import { usePlaygroundStore } from '../store/playgroundStore';

type TokenRow = {
  index: number;
  tokenId: number;
  tokenText: string;
  start: number;
  end: number;
};

type ProjectionPoint = {
  label: string;
  chunkText: string;
  x: number;
  y: number;
  norm: number;
};

type NormalizedProjectionPoint = ProjectionPoint & {
  nx: number;
  ny: number;
};

type DisplacementPoint = {
  label: string;
  chunkText: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  delta: number;
  intensity: number;
};

type AnalyzeResponse = {
  tokenizer: string;
  embeddingModel: string;
  embeddingSource: 'doubao' | 'fallback';
  projectionMethod: 'random' | 'pca' | 'umap';
  tokenCount: number;
  chunkCount: number;
  tokens: TokenRow[];
  projection: ProjectionPoint[];
  comparison: {
    secondaryTokenizer: string;
    secondaryEmbeddingModel: string;
    secondaryEmbeddingSource: 'doubao' | 'fallback';
    secondaryTokenCount: number;
    secondaryTokens: TokenRow[];
    secondaryProjection: ProjectionPoint[];
    tokenOverlapRatio: number;
    neighborhoodAgreement: number;
  };
};

const normalizePoint = (values: number[]): number[] => {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return values.map((value) => (value - min) / span);
};

const getArrowColor = (intensity: number): string => {
  if (intensity > 0.75) {
    return '#dc2626';
  }

  if (intensity > 0.5) {
    return '#ea580c';
  }

  if (intensity > 0.25) {
    return '#ca8a04';
  }

  return '#16a34a';
};

const normalizeProjectionPoints = (projection: ProjectionPoint[]): NormalizedProjectionPoint[] => {
  const xs = normalizePoint(projection.map((item) => item.x));
  const ys = normalizePoint(projection.map((item) => item.y));

  return projection.map((item, index) => ({
    ...item,
    nx: xs[index],
    ny: ys[index],
  }));
};

export const TokenEmbeddingPanel = () => {
  const { authToken } = usePlaygroundStore();
  const [sourceText, setSourceText] = useState('LLM embedding helps cluster semantically similar chunks.');
  const [chunkSize, setChunkSize] = useState(160);
  const [projectionMethod, setProjectionMethod] = useState<'random' | 'pca' | 'umap'>('pca');
  const [secondaryTokenizer, setSecondaryTokenizer] = useState<'cl100k_base' | 'p50k_base'>('p50k_base');
  const [secondaryEmbeddingModel, setSecondaryEmbeddingModel] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [activeTokenRange, setActiveTokenRange] = useState<{ start: number; end: number } | null>(null);
  const [isDiffOverlayEnabled, setIsDiffOverlayEnabled] = useState(true);
  const [activeDisplacementLabel, setActiveDisplacementLabel] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);

  const points = useMemo(() => {
    if (!result || result.projection.length === 0) {
      return [];
    }

    return normalizeProjectionPoints(result.projection);
  }, [result]);

  const secondaryPoints = useMemo(() => {
    if (!result || result.comparison.secondaryProjection.length === 0) {
      return [];
    }

    return normalizeProjectionPoints(result.comparison.secondaryProjection);
  }, [result]);

  const displacementPoints = useMemo(() => {
    if (!points.length || !secondaryPoints.length) {
      return [];
    }

    const items: Array<Omit<DisplacementPoint, 'intensity'>> = points.map((point, index) => {
      const target = secondaryPoints[index];
      const dx = (target?.nx ?? point.nx) - point.nx;
      const dy = (target?.ny ?? point.ny) - point.ny;
      return {
        label: point.label,
        chunkText: point.chunkText,
        fromX: point.nx,
        fromY: point.ny,
        toX: target?.nx ?? point.nx,
        toY: target?.ny ?? point.ny,
        delta: Math.sqrt(dx * dx + dy * dy),
      };
    });

    const maxDelta = Math.max(...items.map((item) => item.delta), 1);
    return items.map((item) => ({
      ...item,
      intensity: item.delta / maxDelta,
    }));
  }, [points, secondaryPoints]);

  const diffSummary = useMemo(() => {
    if (!displacementPoints.length) {
      return null;
    }

    const maxDelta = Math.max(...displacementPoints.map((item) => item.delta));
    const avgDelta =
      displacementPoints.reduce((acc, item) => acc + item.delta, 0) /
      Math.max(1, displacementPoints.length);

    return {
      maxDelta: Number(maxDelta.toFixed(4)),
      avgDelta: Number(avgDelta.toFixed(4)),
    };
  }, [displacementPoints]);

  const topDisplacementPoints = useMemo(() => {
    return [...displacementPoints]
      .sort((left, right) => right.delta - left.delta)
      .slice(0, 5);
  }, [displacementPoints]);

  const highlightedSource = useMemo(() => {
    if (!activeTokenRange) {
      return null;
    }

    const start = Math.max(0, activeTokenRange.start);
    const end = Math.min(sourceText.length, Math.max(start, activeTokenRange.end));

    return {
      before: sourceText.slice(0, start),
      highlight: sourceText.slice(start, end),
      after: sourceText.slice(end),
    };
  }, [activeTokenRange, sourceText]);

  const runAnalyze = async () => {
    if (!authToken) {
      setErrorText('请先输入 JWT 再分析 Token/Embedding。');
      return;
    }

    setIsLoading(true);
    setErrorText('');

    try {
      const response = await fetch(apiUrl('/api/token-embedding/analyze'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          text: sourceText,
          maxChunkSize: chunkSize,
          projectionMethod,
          secondaryTokenizer,
          secondaryEmbeddingModel: secondaryEmbeddingModel || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('analysis request failed');
      }

      const data = (await response.json()) as AnalyzeResponse;
      setResult(data);
      setActiveTokenRange(null);
      setActiveDisplacementLabel(null);
    } catch {
      setErrorText('Token/Embedding 分析失败，请检查模型配置或 JWT。');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="rounded-2xl bg-white/80 p-5 shadow-sm backdrop-blur">
      <h2 className="font-display text-lg text-ink">Token 与 Embedding 调试面板</h2>
      <p className="mt-1 text-sm text-slate-600">LangChain.js 接口 + Token IDs + 向量二维投影（MVP）。</p>

      <textarea
        value={sourceText}
        onChange={(event) => setSourceText(event.target.value)}
        className="mt-3 min-h-24 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none ring-accent transition focus:ring"
      />

      <div className="mt-3 grid gap-3 text-xs text-slate-700 md:grid-cols-2">
        <div className="flex items-center gap-2">
          <span>投影方法</span>
          <select
            value={projectionMethod}
            onChange={(event) => setProjectionMethod(event.target.value as 'random' | 'pca' | 'umap')}
            className="rounded border border-slate-300 px-2 py-1"
          >
            <option value="random">random</option>
            <option value="pca">pca</option>
            <option value="umap">umap</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span>对比分词器</span>
          <select
            value={secondaryTokenizer}
            onChange={(event) => setSecondaryTokenizer(event.target.value as 'cl100k_base' | 'p50k_base')}
            className="rounded border border-slate-300 px-2 py-1"
          >
            <option value="cl100k_base">cl100k_base</option>
            <option value="p50k_base">p50k_base</option>
          </select>
        </div>

        <label className="flex items-center gap-2 md:col-span-2">
          <span>对比 Embedding 模型</span>
          <input
            value={secondaryEmbeddingModel}
            onChange={(event) => setSecondaryEmbeddingModel(event.target.value)}
            placeholder="可选，不填则复用主模型"
            className="w-full rounded border border-slate-300 px-2 py-1"
          />
        </label>
      </div>

      <div className="mt-3 flex items-center gap-3 text-xs text-slate-700">
        <span>分块大小: {chunkSize}</span>
        <input
          type="range"
          min={80}
          max={320}
          step={20}
          value={chunkSize}
          onChange={(event) => setChunkSize(Number(event.target.value))}
          className="w-48"
        />
        <button
          type="button"
          onClick={runAnalyze}
          disabled={isLoading}
          className="rounded-lg bg-accent px-3 py-1.5 text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? '分析中...' : '开始分析'}
        </button>
      </div>

      {errorText && <p className="mt-2 text-xs text-rose-600">{errorText}</p>}

      {result && (
        <>
          <div className="mt-3 grid gap-2 text-xs text-slate-700 md:grid-cols-4">
            <div className="rounded bg-slate-100 px-2 py-1">分词器: {result.tokenizer}</div>
            <div className="rounded bg-slate-100 px-2 py-1">Token 数量: {result.tokenCount}</div>
            <div className="rounded bg-slate-100 px-2 py-1">Chunk 数量: {result.chunkCount}</div>
            <div className="rounded bg-slate-100 px-2 py-1">Embedding 来源: {result.embeddingSource}</div>
            <div className="rounded bg-slate-100 px-2 py-1">投影方法: {result.projectionMethod}</div>
            <div className="rounded bg-slate-100 px-2 py-1">Token 重叠率: {result.comparison.tokenOverlapRatio}</div>
            <div className="rounded bg-slate-100 px-2 py-1">邻域一致率: {result.comparison.neighborhoodAgreement}</div>
            <div className="rounded bg-slate-100 px-2 py-1">对比 Token 数: {result.comparison.secondaryTokenCount}</div>
            {diffSummary && <div className="rounded bg-slate-100 px-2 py-1">平均位移: {diffSummary.avgDelta}</div>}
            {diffSummary && <div className="rounded bg-slate-100 px-2 py-1">最大位移: {diffSummary.maxDelta}</div>}
          </div>

          <label className="mt-3 inline-flex items-center gap-2 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={isDiffOverlayEnabled}
              onChange={(event) => setIsDiffOverlayEnabled(event.target.checked)}
            />
            显示位移热力层（主模型 → 对比模型）
          </label>

          <div className="mt-3 rounded-xl border border-slate-200 p-2">
            <p className="text-xs text-slate-600">Top-K 漂移最大 Chunk</p>
            <div className="mt-2 space-y-1 text-xs text-slate-700">
              {topDisplacementPoints.map((point, index) => (
                <button
                  key={`drift_${point.label}`}
                  type="button"
                  onClick={() =>
                    setActiveDisplacementLabel((current) => (current === point.label ? null : point.label))
                  }
                  className={`block w-full rounded px-2 py-1 text-left ${
                    activeDisplacementLabel === point.label
                      ? 'bg-amber-100 ring-1 ring-amber-300'
                      : 'bg-slate-50 hover:bg-slate-100'
                  }`}
                >
                  <span className="font-medium">#{index + 1} {point.label}</span>
                  <span className="ml-2 text-slate-500">位移: {point.delta.toFixed(4)}</span>
                  <span className="ml-2 text-slate-500">{point.chunkText.slice(0, 56)}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs leading-6 text-slate-700">
            {highlightedSource ? (
              <>
                <span>{highlightedSource.before}</span>
                <mark className="rounded bg-amber-200 px-1">{highlightedSource.highlight || ' '}</mark>
                <span>{highlightedSource.after}</span>
              </>
            ) : (
              <span>{sourceText}</span>
            )}
          </div>

          <div className="mt-3 max-h-40 overflow-auto rounded-xl border border-slate-200 p-2 text-xs">
            {result.tokens.slice(0, 80).map((token) => (
              <button
                key={token.index}
                type="button"
                onClick={() => setActiveTokenRange({ start: token.start, end: token.end })}
                className="mr-1 mb-1 inline-block rounded bg-cyan-50 px-1.5 py-0.5 text-left hover:bg-cyan-100"
              >
                #{token.tokenId}:{token.tokenText.replace(/\n/g, '↵')}
              </button>
            ))}
          </div>

          <div className="mt-2 max-h-32 overflow-auto rounded-xl border border-slate-200 p-2 text-xs">
            {result.comparison.secondaryTokens.slice(0, 80).map((token) => (
              <span key={token.index} className="mr-1 mb-1 inline-block rounded bg-indigo-50 px-1.5 py-0.5">
                #{token.tokenId}:{token.tokenText.replace(/\n/g, '↵')}
              </span>
            ))}
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-2">
              <p className="mb-2 text-xs text-slate-500">主模型 Embedding</p>
              <svg viewBox="0 0 360 220" className="h-56 w-full">
                {isDiffOverlayEnabled && (
                  <defs>
                    <marker id="diff-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="#ef4444" />
                    </marker>
                  </defs>
                )}

                {isDiffOverlayEnabled &&
                  displacementPoints.map((point) => (
                    <line
                      key={`diff_${point.label}`}
                      x1={20 + point.fromX * 320}
                      y1={20 + (1 - point.fromY) * 180}
                      x2={20 + point.toX * 320}
                      y2={20 + (1 - point.toY) * 180}
                      stroke={getArrowColor(point.intensity)}
                      strokeWidth={activeDisplacementLabel === point.label ? 2.8 : 1.6}
                      strokeOpacity={activeDisplacementLabel === point.label ? 1 : 0.7}
                      markerEnd="url(#diff-arrow)"
                    />
                  ))}

                {points.map((point) => (
                  <g key={point.label}>
                    <circle
                      cx={20 + point.nx * 320}
                      cy={20 + (1 - point.ny) * 180}
                      r={activeDisplacementLabel === point.label ? 6.8 : 5}
                      fill="#0f766e"
                      opacity={activeDisplacementLabel === point.label ? 1 : 0.8}
                      stroke={activeDisplacementLabel === point.label ? '#f59e0b' : 'none'}
                      strokeWidth={activeDisplacementLabel === point.label ? 2 : 0}
                    />
                    <title>{`${point.label}: ${point.chunkText}`}</title>
                  </g>
                ))}
              </svg>
            </div>

            <div className="rounded-xl border border-slate-200 p-2">
              <p className="mb-2 text-xs text-slate-500">对比模型 Embedding</p>
              <svg viewBox="0 0 360 220" className="h-56 w-full">
                {secondaryPoints.map((point) => (
                  <g key={point.label}>
                    <circle
                      cx={20 + point.nx * 320}
                      cy={20 + (1 - point.ny) * 180}
                      r={activeDisplacementLabel === point.label ? 6.8 : 5}
                      fill="#3730a3"
                      opacity={activeDisplacementLabel === point.label ? 1 : 0.8}
                      stroke={activeDisplacementLabel === point.label ? '#f59e0b' : 'none'}
                      strokeWidth={activeDisplacementLabel === point.label ? 2 : 0}
                    />
                    <title>{`${point.label}: ${point.chunkText}`}</title>
                  </g>
                ))}
              </svg>
            </div>
          </div>
        </>
      )}
    </section>
  );
};
