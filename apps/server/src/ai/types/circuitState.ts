/** F-01: 熔断器状态 */
export type CircuitState = 'closed' | 'open' | 'half_open';

export const CIRCUIT_STATES: readonly CircuitState[] = [
  'closed',
  'open',
  'half_open',
] as const;
