import {
  getGuardrailBlockPatterns,
  getGuardrailMaxPromptChars,
  isGuardrailEnabled,
} from './guardrailConfig.js';

export type GuardrailCheckResult =
  | { blocked: false }
  | { blocked: true; reason: string };

export const checkInputGuardrail = (text: string): GuardrailCheckResult => {
  if (!isGuardrailEnabled()) {
    return { blocked: false };
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return { blocked: true, reason: 'empty prompt' };
  }

  const maxChars = getGuardrailMaxPromptChars();
  if (trimmed.length > maxChars) {
    return { blocked: true, reason: `prompt exceeds ${maxChars} chars` };
  }

  for (const pattern of getGuardrailBlockPatterns()) {
    if (pattern.test(trimmed)) {
      return { blocked: true, reason: `matched blocked pattern: ${pattern.source}` };
    }
  }

  return { blocked: false };
};
