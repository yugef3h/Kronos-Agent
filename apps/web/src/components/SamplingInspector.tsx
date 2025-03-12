import { useMemo } from 'react';
import { usePlaygroundStore } from '../store/playgroundStore';

const mockLogits = [2.9, 2.1, 1.5, 1.1, 0.8, 0.3];

const toProbabilities = (temperature: number): number[] => {
  const max = Math.max(...mockLogits);
  const exps = mockLogits.map((logit) => Math.exp((logit - max) / temperature));
  const sum = exps.reduce((acc, current) => acc + current, 0);
  return exps.map((value) => value / sum);
};

export const SamplingInspector = () => {
  const { temperature, topP, setTemperature, setTopP } = usePlaygroundStore();

  const probabilities = useMemo(() => toProbabilities(temperature), [temperature]);

  return (
    <section className="rounded-2xl bg-white/80 p-5 shadow-sm backdrop-blur">
      <h2 className="font-display text-lg text-ink">Sampling Inspector</h2>
      <p className="mt-1 text-sm text-slate-600">实时观察 score 到 probability 的变化。</p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm text-slate-700">
          Temperature: {temperature.toFixed(2)}
          <input
            type="range"
            min={0.2}
            max={1.5}
            step={0.1}
            value={temperature}
            onChange={(event) => setTemperature(Number(event.target.value))}
            className="w-full"
          />
        </label>

        <label className="space-y-2 text-sm text-slate-700">
          Top-P: {topP.toFixed(2)}
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.05}
            value={topP}
            onChange={(event) => setTopP(Number(event.target.value))}
            className="w-full"
          />
        </label>
      </div>

      <div className="mt-4 space-y-2">
        {probabilities.map((value, index) => (
          <div key={index} className="flex items-center gap-3 text-xs text-slate-600">
            <span className="w-14">Token {index + 1}</span>
            <div className="h-2 flex-1 rounded bg-slate-200">
              <div className="h-2 rounded bg-signal" style={{ width: `${Math.min(value * 100, 100)}%` }} />
            </div>
            <span className="w-12 text-right">{(value * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </section>
  );
};
