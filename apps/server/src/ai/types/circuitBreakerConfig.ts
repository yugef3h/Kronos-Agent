/** F-02: 熔断器配置 */
export type CircuitBreakerConfig = {
  failureThreshold: number;
  openMs: number;
  halfOpenProbe: number;
};

export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  openMs: 30_000,
  halfOpenProbe: 1,
};
