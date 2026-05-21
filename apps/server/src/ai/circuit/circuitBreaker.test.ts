import {
  clearCircuitBreakers,
  createCircuitBreaker,
  isCircuitOpen,
  recordCircuitFailure,
  recordCircuitSuccess,
} from './circuitBreaker.js';

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
      openMs: 0,
      halfOpenProbe: 1,
    });

    recordCircuitFailure(breaker.name);
    expect(isCircuitOpen(breaker.name)).toBe(true);

    recordCircuitSuccess(breaker.name, Date.now() + 1);
    expect(isCircuitOpen(breaker.name)).toBe(false);
  });
});
