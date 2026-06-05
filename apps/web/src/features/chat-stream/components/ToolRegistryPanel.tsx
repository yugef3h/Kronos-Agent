import { useEffect, useState } from 'react';

import { ensureKnowledgeDatasetAuthToken } from '../../../domains/knowledge/dataset-store';
import { requestPlaygroundTools, type PlaygroundToolDescriptor } from '../../../lib/api/playground-tools';

export const ToolRegistryPanel = () => {
  const [tools, setTools] = useState<PlaygroundToolDescriptor[]>([]);
  const [configuredToolNames, setConfiguredToolNames] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isExpanded) {
      return undefined;
    }

    let cancelled = false;

    const loadTools = async () => {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const authToken = await ensureKnowledgeDatasetAuthToken();
        if (!authToken) {
          throw new Error('需要 JWT 鉴权');
        }

        const payload = await requestPlaygroundTools({ authToken });
        if (cancelled) {
          return;
        }

        setTools(payload.tools);
        setConfiguredToolNames(payload.configuredToolNames);
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : '加载工具失败';
          setErrorMessage(message);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadTools();

    return () => {
      cancelled = true;
    };
  }, [isExpanded]);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 text-xs text-slate-700">
      <button
        type="button"
        onClick={() => setIsExpanded((current) => !current)}
        className="flex w-full items-center justify-between px-3 py-2 text-left font-medium text-slate-800"
      >
        <span>已注册工具 ({tools.length || '—'})</span>
        <span>{isExpanded ? '收起' : '展开'}</span>
      </button>

      {isExpanded ? (
        <div className="space-y-2 border-t border-slate-200 px-3 pb-3 pt-2">
          {isLoading ? <p className="text-slate-500">加载中…</p> : null}
          {errorMessage ? <p className="text-rose-600">{errorMessage}</p> : null}
          {!isLoading && !errorMessage && tools.length === 0 ? (
            <p className="text-slate-500">当前环境未注册 Playground 工具（如未配置 TAVILY_API_KEY）。</p>
          ) : null}
          {configuredToolNames.length > 0 ? (
            <p className="text-slate-500">配置项：{configuredToolNames.join(', ')}</p>
          ) : null}
          {tools.map((tool) => (
            <article key={tool.name} className="rounded-lg border border-slate-100 bg-white px-2.5 py-2">
              <div className="flex items-center gap-2">
                <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-semibold text-emerald-800">{tool.name}</span>
                <span className={`rounded px-1.5 py-0.5 ${tool.enabled ? 'bg-cyan-50 text-cyan-700' : 'bg-slate-100 text-slate-500'}`}>
                  {tool.enabled ? 'enabled' : 'disabled'}
                </span>
              </div>
              <p className="mt-1 leading-relaxed text-slate-600">{tool.description}</p>
              <pre className="mt-1 max-h-24 overflow-auto rounded bg-slate-50 p-2 font-mono text-[10px] text-slate-500">
                {JSON.stringify(tool.parameters, null, 2)}
              </pre>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
};
