import { getGuardrailBlockPatterns, isGuardrailEnabled } from './guardrailConfig.js';
import type { GuardrailCheckResult } from './checkInputGuardrail.js';

export const checkOutputGuardrail = (text: string): GuardrailCheckResult => {
  if (!isGuardrailEnabled()) {
    return { blocked: false };
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return { blocked: false };
  }

  for (const pattern of getGuardrailBlockPatterns()) {
    if (pattern.test(trimmed)) {
      return { blocked: true, reason: `output matched blocked pattern: ${pattern.source}` };
    }
  }

  return { blocked: false };
};
