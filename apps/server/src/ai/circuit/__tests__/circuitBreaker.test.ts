import {
  clearCircuitBreakers,
  createCircuitBreaker,
  isCircuitOpen,
  recordCircuitFailure,
  recordCircuitSuccess,
} from '../circuitBreaker.js';

describe('circuitBreaker', () => {
  beforeEach(() => {
    clearCircuitBreakers();
  });

  it('opens after failure threshold', () => {
    const breaker = createCircuitBreaker('doubao', {
      failureThreshold: 2,
      openMs: 1000,
      halfOpenProbe: 1,
    });

    recordCircuitFailure(breaker.name);
    expect(isCircuitOpen(breaker.name)).toBe(false);

    recordCircuitFailure(breaker.name);
    expect(isCircuitOpen(breaker.name)).toBe(true);
  });

  it('closes after success in half_open', () => {
    const breaker = createCircuitBreaker('doubao', {
      failureThreshold: 1,
      openMs: 1000,
      halfOpenProbe: 1,
    });

    const t0 = 1000;
    recordCircuitFailure(breaker.name, t0);
    expect(isCircuitOpen(breaker.name, t0)).toBe(true);

    const t1 = t0 + 1000;
    recordCircuitSuccess(breaker.name, t1);
    expect(isCircuitOpen(breaker.name, t1)).toBe(false);
  });
});
