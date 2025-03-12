import { useMemo } from 'react';

const size = 6;

const makeMatrix = (): number[][] =>
  Array.from({ length: size }, (_, i) =>
    Array.from({ length: size }, (_, j) => {
      if (j > i) return 0;
      return Number((Math.random() * 0.95 + 0.05).toFixed(2));
    }),
  );

export const AttentionHeatmap = () => {
  const matrix = useMemo(() => makeMatrix(), []);

  return (
    <section className="rounded-2xl bg-white/80 p-5 shadow-sm backdrop-blur">
      <h2 className="font-display text-lg text-ink">Attention Heatmap</h2>
      <p className="mt-1 text-sm text-slate-600">先用 mock 数据验证 UI，后续可接 LangChain 自定义链返回的权重矩阵。</p>

      <div className="mt-4 grid grid-cols-6 gap-2">
        {matrix.flatMap((row, rowIndex) =>
          row.map((value, colIndex) => (
            <div
              key={`${rowIndex}-${colIndex}`}
              className="aspect-square rounded-md border border-slate-100"
              style={{
                backgroundColor: `rgba(15, 118, 110, ${value})`,
              }}
              title={`q${rowIndex} -> k${colIndex}: ${value}`}
            />
          )),
        )}
      </div>
    </section>
  );
};
