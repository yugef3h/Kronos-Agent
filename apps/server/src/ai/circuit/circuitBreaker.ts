import type { CircuitBreakerConfig } from '../types/circuitBreakerConfig.js';
import { DEFAULT_CIRCUIT_BREAKER_CONFIG } from '../types/circuitBreakerConfig.js';
import type { CircuitState } from '../types/circuitState.js';

export type CircuitBreaker = {
  name: string;
  state: CircuitState;
  failureCount: number;
  openedAtMs: number | null;
  config: CircuitBreakerConfig;
};

const breakers = new Map<string, CircuitBreaker>();

/** F-03: 创建或获取命名熔断器 */
export const createCircuitBreaker = (
  name: string,
  config: CircuitBreakerConfig = DEFAULT_CIRCUIT_BREAKER_CONFIG,
): CircuitBreaker => {
  const existing = breakers.get(name);
  if (existing) {
    return existing;
  }

  const breaker: CircuitBreaker = {
    name,
    state: 'closed',
    failureCount: 0,
    openedAtMs: null,
    config,
  };
  breakers.set(name, breaker);
  return breaker;
};

export const getCircuitBreaker = (name: string): CircuitBreaker | undefined => breakers.get(name);

export const clearCircuitBreakers = (): void => {
  breakers.clear();
};

const transitionToOpen = (breaker: CircuitBreaker, nowMs: number): void => {
  breaker.state = 'open';
  breaker.openedAtMs = nowMs;
};

const transitionToHalfOpen = (breaker: CircuitBreaker): void => {
  breaker.state = 'half_open';
  breaker.failureCount = 0;
};

const transitionToClosed = (breaker: CircuitBreaker): void => {
  breaker.state = 'closed';
  breaker.failureCount = 0;
  breaker.openedAtMs = null;
};

const maybeAdvanceOpenState = (breaker: CircuitBreaker, nowMs: number): void => {
  if (breaker.state !== 'open' || breaker.openedAtMs == null) {
    return;
  }

  if (nowMs - breaker.openedAtMs >= breaker.config.openMs) {
    transitionToHalfOpen(breaker);
  }
};

/** F-04: 记录成功，关闭或保持 half_open → closed */
export const recordCircuitSuccess = (name: string, nowMs = Date.now()): void => {
  const breaker = createCircuitBreaker(name);
  maybeAdvanceOpenState(breaker, nowMs);

  if (breaker.state === 'half_open' || breaker.state === 'open') {
    transitionToClosed(breaker);
    return;
  }

  breaker.failureCount = 0;
};

/** F-04: 记录失败，达阈值则 open */
export const recordCircuitFailure = (name: string, nowMs = Date.now()): void => {
  const breaker = createCircuitBreaker(name);
  maybeAdvanceOpenState(breaker, nowMs);

  if (breaker.state === 'half_open') {
    transitionToOpen(breaker, nowMs);
    return;
  }

  breaker.failureCount += 1;
  if (breaker.failureCount >= breaker.config.failureThreshold) {
    transitionToOpen(breaker, nowMs);
  }
};

/** F-05: 是否应拒绝请求（open 且未到 half_open 窗口） */
export const isCircuitOpen = (name: string, nowMs = Date.now()): boolean => {
  const breaker = breakers.get(name);
  if (!breaker) {
    return false;
  }

  maybeAdvanceOpenState(breaker, nowMs);
  return breaker.state === 'open';
};
