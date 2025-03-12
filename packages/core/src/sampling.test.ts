import { normalizeLogits } from './sampling';

describe('normalizeLogits', () => {
  it('should keep high probability tokens based on topP threshold', () => {
    const logits = [4, 3, 2, 1];
    const result = normalizeLogits(logits, { temperature: 1, topP: 0.7 });

    const kept = result.filter((value) => value > 0);
    expect(kept.length).toBeGreaterThan(0);
    expect(result[0]).toBeGreaterThanOrEqual(result[1]);
  });

  it('should produce stable distribution when temperature decreases', () => {
    const logits = [2.4, 2.2, 0.5, 0.3];
    const result = normalizeLogits(logits, { temperature: 0.3, topP: 0.9 });

    expect(result[0]).toBeGreaterThan(result[2]);
    expect(result[1]).toBeGreaterThan(result[3]);
  });
});
