import type { SamplingConfig } from './types';

export const normalizeLogits = (logits: number[], config: SamplingConfig): number[] => {
  const max = Math.max(...logits);
  const exps = logits.map((value) => Math.exp((value - max) / config.temperature));
  const sum = exps.reduce((acc, current) => acc + current, 0);
  const probs = exps.map((value) => value / sum);

  const sorted = [...probs].sort((a, b) => b - a);
  let cumulative = 0;
  const threshold = sorted.find((value) => {
    cumulative += value;
    return cumulative >= config.topP;
  }) || 0;

  return probs.map((value) => (value >= threshold ? value : 0));
};
