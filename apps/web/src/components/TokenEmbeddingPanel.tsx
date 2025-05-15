import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { requestTokenEmbeddingAnalysis } from '../lib/api';
import { usePlaygroundStore } from '../store/playgroundStore';

type TokenKind = 'high-frequency' | 'chinese' | 'english' | 'symbol';

type ParsedToken = {
  index: number;
  id: number;
  text: string;
  displayText: string;
  probability: number;
  kind: TokenKind;
};

type AttentionDataSource = 'embedding-association' | 'frontend-sim';

const MAX_CONTEXT_TOKENS = 8192;
const ATTENTION_TOKEN_LIMIT = 24;
const HIGH_FREQUENCY_PATTERNS = [/\bLLM\b/i, /\bAI\b/i, /\bGPT\b/i, /transformer/i, /agent/i, /token/i];
// const SSE_CHAT_STREAM_TEMPLATE_FALLBACK_INPUT = [
//   '当然 new EventSource().onmessage 也可以实现基本的 SSE，但不支持 POST 和断点续传，且在网络异常时重连机制不够灵活。',
//   '推荐使用 fetch + ReadableStream + AbortController 方案，实现流式读取、指数退避重连和 Last-Event-ID 续传。',
//   '同时在前端维护 sessionId 与 isStreaming 状态，避免并发请求导致响应乱序。',
// ].join('\n');
const SSE_CHAT_STREAM_TEMPLATE_FALLBACK_INPUT = '';

const TOKEN_KIND_STYLE: Record<TokenKind, string> = {
  'high-frequency': 'border-orange-200 bg-orange-50 text-orange-700',
  chinese: 'border-slate-300 bg-white text-slate-900',
  english: 'border-blue-200 bg-blue-50 text-blue-700',
  symbol: 'border-slate-200 bg-slate-100 text-slate-500',
};

const getDisplayTokenText = (text: string): string => {
  // BPE 里部分 token 只是 UTF-8 字节片段（尤其中文），单独 decode 可能是空串或含 U+FFFD。
  // UI 层只做可读性规整，不改变真实 token id。
  const normalized = text
    .replace(/\uFFFD+/g, '')
    .replace(/\r/g, '↩')
    .replace(/\n/g, '↵')
    .replace(/\t/g, '⇥')
    .replace(/ /g, '␠')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '·');

  return normalized;
};

const isHighFrequencyToken = (text: string): boolean => {
  return HIGH_FREQUENCY_PATTERNS.some((pattern) => pattern.test(text.trim()));
};

const classifyTokenKind = (text: string): TokenKind => {
  if (isHighFrequencyToken(text)) {
    return 'high-frequency';
  }

  if (/[\u4e00-\u9fff]/.test(text)) {
    return 'chinese';
  }

  if (/[A-Za-z]/.test(text)) {
    return 'english';
  }

  return 'symbol';
};

const buildPseudoProbabilities = (tokenIds: number[]): number[] => {
  const raw = tokenIds.map((tokenId, index) => {
    const value = Math.abs(Math.sin(tokenId * 12.9898 + (index + 1) * 78.233));
    return value + 0.001;
  });

  const total = raw.reduce((acc, value) => acc + value, 0) || 1;
  return raw.map((value) => value / total);
};

const uniqueChars = (text: string): Set<string> => new Set(Array.from(text));

const tokenSemanticSimilarity = (left: ParsedToken, right: ParsedToken): number => {
  const leftChars = uniqueChars(left.text.toLowerCase());
  const rightChars = uniqueChars(right.text.toLowerCase());

  let intersection = 0;
  for (const char of leftChars) {
    if (rightChars.has(char)) {
      intersection += 1;
    }
  }

  const union = Math.max(1, leftChars.size + rightChars.size - intersection);
  return intersection / union;
};

const softmax = (values: number[]): number[] => {
  const max = Math.max(...values);
  const exps = values.map((value) => Math.exp(value - max));
  const sum = exps.reduce((acc, value) => acc + value, 0) || 1;
  return exps.map((value) => value / sum);
};

const buildAttentionMatrix = (tokens: ParsedToken[]): number[][] => {
  // 前端模拟注意力: 结合因果掩码、位置衰减和 token 语义相似度，生成可解释热力图。
  return tokens.map((queryToken, queryIndex) => {
    const logits = tokens.map((keyToken, keyIndex) => {
      if (keyIndex > queryIndex) {
        return Number.NEGATIVE_INFINITY;
      }

      const distanceBias = Math.exp(-(queryIndex - keyIndex) / 6);
      const semanticBias = tokenSemanticSimilarity(queryToken, keyToken);
      const typeBias = queryToken.kind === keyToken.kind ? 0.12 : 0;
      const hotBias = keyToken.kind === 'high-frequency' ? 0.1 : 0;
      return 1.7 * distanceBias + 1.2 * semanticBias + typeBias + hotBias;
    });

    const validValues = logits.map((value) => (Number.isFinite(value) ? value : -1e9));
    const weights = softmax(validValues);

    return weights.map((weight, index) => {
      if (index > queryIndex) {
        return 0;
      }

      return Number(weight.toFixed(4));
    });
  });
};

export const TokenEmbeddingPanel = () => {
  const latestUserQuestion = usePlaygroundStore((state) => state.latestUserQuestion);
  const authToken = usePlaygroundStore((state) => state.authToken);
  const [inputText, setInputText] = useState('基于Transformer的LLM在长上下文场景下会变笨。');
  const [isSseTemplateMode, setIsSseTemplateMode] = useState(true);
  const [tokens, setTokens] = useState<ParsedToken[]>([]);
  const [serverAttentionMatrix, setServerAttentionMatrix] = useState<number[][] | null>(null);
  const [attentionDataSource, setAttentionDataSource] = useState<AttentionDataSource>('frontend-sim');
  const [attentionNote, setAttentionNote] = useState('前端模拟注意力（字符语义 + 距离偏置）');
  const [hasPythonServiceAttention, setHasPythonServiceAttention] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [selectedTokenIndex, setSelectedTokenIndex] = useState(0);
  const [isParsing, setIsParsing] = useState(false);
  const previousModeRef = useRef(isSseTemplateMode);
  const associationRequestSeqRef = useRef(0);

  const activeInputText = isSseTemplateMode
    ? (latestUserQuestion.trim() || SSE_CHAT_STREAM_TEMPLATE_FALLBACK_INPUT)
    : inputText;

  const attentionTokens = useMemo(() => tokens.slice(0, ATTENTION_TOKEN_LIMIT), [tokens]);

  const attentionMatrix = useMemo(() => {
    if (attentionTokens.length === 0) {
      return [];
    }

    if (serverAttentionMatrix && serverAttentionMatrix.length > 0) {
      const size = Math.min(attentionTokens.length, serverAttentionMatrix.length);
      return serverAttentionMatrix.slice(0, size).map((row) => row.slice(0, size));
    }

    return buildAttentionMatrix(attentionTokens);
  }, [attentionTokens, serverAttentionMatrix]);

  const contextUsageRatio = useMemo(() => {
    return Number(((tokens.length / MAX_CONTEXT_TOKENS) * 100).toFixed(2));
  }, [tokens]);

  const selectedAssociations = useMemo(() => {
    if (!attentionMatrix.length || selectedTokenIndex >= attentionMatrix.length) {
      return [];
    }

    const row = attentionMatrix[selectedTokenIndex];
    return row
      .map((score, index) => ({
        index,
        token: attentionTokens[index],
        score,
      }))
      .filter((item) => item.index <= selectedTokenIndex)
      .sort((left, right) => right.score - left.score)
      .slice(0, 5);
  }, [attentionMatrix, attentionTokens, selectedTokenIndex]);

  const parseTokens = useCallback(async (sourceText?: string) => {
    const trimmed = (sourceText ?? activeInputText).trim();
    const requestSeq = associationRequestSeqRef.current + 1;
    associationRequestSeqRef.current = requestSeq;

    if (!trimmed) {
      setTokens([]);
      setServerAttentionMatrix(null);
      setAttentionDataSource('frontend-sim');
      setAttentionNote('前端模拟注意力（字符语义 + 距离偏置）');
      setHasPythonServiceAttention(false);
      setErrorText('');
      return;
    }

    const buildLocalTokens = async () => {
      const tokenizer = await import('gpt-tokenizer/encoding/cl100k_base');
      const tokenIds = Array.from(tokenizer.encode(trimmed));
      const probabilities = buildPseudoProbabilities(tokenIds);

      const nextTokens: ParsedToken[] = tokenIds.map((id, index) => {
        const tokenText = tokenizer.decode([id]);
        return {
          index,
          id,
          text: tokenText,
          displayText: getDisplayTokenText(tokenText),
          probability: probabilities[index],
          kind: classifyTokenKind(tokenText),
        };
      });

      setTokens(nextTokens);
      setServerAttentionMatrix(null);
      setAttentionDataSource('frontend-sim');
      setAttentionNote('前端模拟注意力（字符语义 + 距离偏置）');
      setHasPythonServiceAttention(false);
      setSelectedTokenIndex((previousIndex) =>
        Math.min(previousIndex, Math.max(0, nextTokens.length - 1)),
      );
    };

    try {
      setIsParsing(true);
      await buildLocalTokens();
      setErrorText('');
    } catch {
      setErrorText('Token 解析失败，请检查输入内容。');
      setTokens([]);
      setServerAttentionMatrix(null);
      setHasPythonServiceAttention(false);
      setIsParsing(false);
      return;
    } finally {
      setIsParsing(false);
    }

    if (!authToken) {
      return;
    }

    setAttentionNote('后端 embedding 关联计算中，当前先展示前端模拟结果。');

    void (async () => {
      try {
        const analysis = await requestTokenEmbeddingAnalysis({
          authToken,
          text: trimmed,
          attentionTokenLimit: ATTENTION_TOKEN_LIMIT,
        });

        if (associationRequestSeqRef.current !== requestSeq) {
          return;
        }

        const tokenizer = await import('gpt-tokenizer/encoding/cl100k_base');
        const tokenIds = analysis.tokens.map((token) => token.tokenId);
        const probabilities = buildPseudoProbabilities(tokenIds);
        const nextTokens: ParsedToken[] = analysis.tokens.map((token, index) => {
          // 优先用 tokenId 本地 decode；若为空再回退到后端 offset 切片，尽量减少“看起来空白”的 token。
          const decodedTokenText = tokenizer.decode([token.tokenId]);
          const sourceSlice = trimmed.slice(token.start, token.end);
          const resolvedText = decodedTokenText || sourceSlice || '';

          return {
            index: token.index,
            id: token.tokenId,
            text: resolvedText,
            displayText: getDisplayTokenText(resolvedText),
            probability: probabilities[index],
            kind: classifyTokenKind(resolvedText),
          };
        });

        const hasPythonAssociation = analysis.attentionAssociation?.embeddingSource === 'python-service';

        setTokens(nextTokens);
        setServerAttentionMatrix(hasPythonAssociation ? (analysis.attentionAssociation?.matrix || null) : null);
        setAttentionDataSource(hasPythonAssociation ? 'embedding-association' : 'frontend-sim');
        setAttentionNote(
          hasPythonAssociation
            ? (analysis.attentionAssociation?.note || 'Python 微服务已返回真实向量关联矩阵。')
            : 'Python 微服务未开启或未返回真实向量，核心关联视图已隐藏。',
        );
        setHasPythonServiceAttention(hasPythonAssociation);
        setSelectedTokenIndex((previousIndex) =>
          Math.min(previousIndex, Math.max(0, nextTokens.length - 1)),
        );
      } catch {
        if (associationRequestSeqRef.current !== requestSeq) {
          return;
        }

        setServerAttentionMatrix(null);
        setAttentionDataSource('frontend-sim');
        setAttentionNote('Python 微服务关联计算失败或不可用，核心关联视图已隐藏。');
        setHasPythonServiceAttention(false);
      }
    })();
  }, [activeInputText, authToken]);

  useEffect(() => {
    const hasModeChanged = previousModeRef.current !== isSseTemplateMode;
    previousModeRef.current = isSseTemplateMode;

    if (isSseTemplateMode || hasModeChanged) {
      void parseTokens(activeInputText);
    }
  }, [activeInputText, isSseTemplateMode, parseTokens]);

  return (
    <section className="rounded-2xl bg-white/85 p-5 shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="font-display text-lg text-ink font-bold">Token 切分</h2>
        <div className="flex flex-col items-end gap-1">
          <button
            type="button"
            onClick={() => setIsSseTemplateMode((prev) => !prev)}
            className={`relative inline-flex h-7 w-14 items-center rounded-full border px-1 transition ${isSseTemplateMode
                ? 'border-cyan-300 bg-cyan-500/90'
                : 'border-slate-300 bg-slate-300/90'
              }`}
            aria-pressed={isSseTemplateMode}
            aria-label="切换 SSE 模版输入"
            title={isSseTemplateMode ? '已开启：默认使用 SSE Chat Stream 最新问题' : '已关闭：可自定义输入'}
          >
            <span
              className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition ${isSseTemplateMode ? 'translate-x-7' : 'translate-x-0'
                }`}
            />
          </button>
          <p className="text-[11px] leading-4 text-slate-500">
            开启: 跟随左侧最新问题 | 关闭: 使用自定义输入
          </p>
        </div>
      </div>
      <p className="mt-1 text-sm text-slate-600">第一步看 Token 切分，核心步看关联热力图。</p>
      <p className="mt-1 text-xs text-slate-500">
        输入模式：{isSseTemplateMode ? 'SSE Chat Stream 最新问题（默认）' : '自定义文本'}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        关联数据源：{attentionDataSource === 'embedding-association' ? '后端关联（可由 Python 微服务或 embedding 生成）' : '前端模拟'}
      </p>

      <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
        <textarea
          value={activeInputText}
          onChange={(event) => setInputText(event.target.value)}
          disabled={isSseTemplateMode}
          className="min-h-28 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none ring-cyan-300 transition focus:ring disabled:cursor-not-allowed disabled:bg-slate-50"
          placeholder="关闭右上角开关后可输入自定义文本"
        />
        <button
          type="button"
          onClick={() => void parseTokens()}
          disabled={isParsing}
          className="h-fit rounded-xl bg-gradient-to-r from-cyan-600 to-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isParsing ? '解析中...' : '解析 Token'}
        </button>
      </div>

      {errorText && <p className="mt-2 text-xs text-rose-600">{errorText}</p>}

      <div className="mt-3 grid gap-2 text-xs text-slate-700 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5">总 Token 数: {tokens.length}</div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5">上下文占用模拟: {contextUsageRatio}% / 8K</div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5">注意力热力图: {Math.min(tokens.length, ATTENTION_TOKEN_LIMIT)} 个 Token</div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5">Tokenizer: cl100k_base</div>
      </div>

      {tokens.length > 0 && (<div className="mt-3 max-h-44 overflow-auto rounded-xl border border-slate-200 p-2">
        <div className="flex flex-wrap gap-2">
          {tokens.map((token) => (
            <button
              key={`${token.index}-${token.id}`}
              type="button"
              onClick={() => setSelectedTokenIndex(token.index)}
              className={`min-w-[90px] rounded-xl border px-2 py-1 text-left text-xs transition hover:-translate-y-0.5 ${TOKEN_KIND_STYLE[token.kind]} ${selectedTokenIndex === token.index ? 'ring-2 ring-cyan-300' : ''
                }`}
              title={`token_${token.index}`}
            >
              <p className="truncate font-medium">{token.displayText}</p>
              <p className="text-[11px] opacity-80">ID: {token.id}</p>
              <p className="text-[11px] opacity-80">P: {(token.probability * 100).toFixed(2)}%</p>
            </button>
          ))}
        </div>
      </div>
      )}

      {tokens.length > ATTENTION_TOKEN_LIMIT && (
        <p className="mt-2 text-xs text-amber-700">
          为保证前端实时渲染性能，注意力热力图仅展示前 {ATTENTION_TOKEN_LIMIT} 个 Token。
        </p>
      )}

      {hasPythonServiceAttention ? (
        <>
          <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(240px,0.6fr)]">
            <div className="rounded-xl border border-slate-200 p-2">
              <p className="mb-1 text-xs text-slate-500">核心步: 关联热力图（行: Query，列: Key）</p>
              <p className="mb-2 text-[11px] text-slate-400">{attentionNote}</p>
              <div
                className="grid gap-1"
                style={{
                  gridTemplateColumns: `repeat(${Math.max(1, attentionTokens.length)}, minmax(0, 1fr))`,
                }}
              >
                {attentionMatrix.flatMap((row, queryIndex) =>
                  row.map((value, keyIndex) => (
                    <button
                      key={`${queryIndex}-${keyIndex}`}
                      type="button"
                      onClick={() => setSelectedTokenIndex(queryIndex)}
                      className="aspect-square rounded-md border border-slate-100"
                      style={{
                        backgroundColor: `rgba(14, 116, 144, ${Math.min(1, value * 2.2)})`,
                      }}
                      title={`q${queryIndex}(${attentionTokens[queryIndex]?.displayText}) -> k${keyIndex}(${attentionTokens[keyIndex]?.displayText}): ${value.toFixed(4)}`}
                    />
                  )),
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-2 text-xs">
              <p className="font-semibold text-slate-700">当前 Query Token: #{selectedTokenIndex}</p>
              <p className="mt-1 rounded bg-slate-100 px-2 py-1 text-slate-700">
                {attentionTokens[selectedTokenIndex]?.displayText || '未选择'}
              </p>

              <p className="mt-2 text-slate-500">Top 注意力关联</p>
              <div className="mt-1 space-y-1">
                {selectedAssociations.map((item) => (
                  <div key={item.index} className="rounded border border-slate-100 bg-slate-50 px-2 py-1">
                    <p className="truncate text-slate-700">
                      k{item.index}: {item.token.displayText}
                    </p>
                    <p className="text-[11px] text-slate-500">score: {item.score.toFixed(4)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-3 max-h-44 overflow-auto rounded-xl border border-slate-200 p-2 text-xs">
            <p className="mb-2 text-slate-500">Token 详情（ID / 概率 / 类型）</p>
            <table className="w-full table-fixed border-collapse">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="w-16 py-1">序号</th>
                  <th className="w-24 py-1">ID</th>
                  <th className="w-24 py-1">概率</th>
                  <th className="w-28 py-1">类型</th>
                  <th className="py-1">文本</th>
                </tr>
              </thead>
              <tbody>
                {tokens.map((token) => (
                  <tr key={`detail-${token.index}-${token.id}`} className="border-t border-slate-100 text-slate-700">
                    <td className="py-1">{token.index}</td>
                    <td className="py-1">{token.id}</td>
                    <td className="py-1">{(token.probability * 100).toFixed(2)}%</td>
                    <td className="py-1">{token.kind}</td>
                    <td className="truncate py-1" title={token.text}>{token.displayText}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          未检测到 Python 微服务生成的真实向量 Token，已隐藏核心关联热力图与详情区域。
        </p>
      )}
    </section>
  );
};
