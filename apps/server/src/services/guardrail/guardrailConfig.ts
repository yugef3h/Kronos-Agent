const DEFAULT_BLOCK_PATTERNS = [
  'password\\s*[:=]',
  'api[_-]?key\\s*[:=]',
  '1[3-9]\\d{9}',
];

export const isGuardrailEnabled = (): boolean =>
  (process.env.GUARDRAIL_ENABLED ?? 'false').trim().toLowerCase() === 'true';

export const getGuardrailBlockPatterns = (): RegExp[] => {
  const raw = process.env.GUARDRAIL_BLOCK_PATTERNS?.trim();
  const patterns = raw
    ? raw.split(',').map((item) => item.trim()).filter(Boolean)
    : DEFAULT_BLOCK_PATTERNS;

  return patterns.map((pattern) => new RegExp(pattern, 'i'));
};

export const getGuardrailMaxPromptChars = (): number => {
  const parsed = Number(process.env.GUARDRAIL_MAX_PROMPT_CHARS ?? '12000');
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 12000;
};
