import type { WorkflowChatbotPromptVariable } from '../../../../../domains/workflow/editor/panels/workflow/workflowAppStore';

/** 与提示词中 `{{name}}` 占位符匹配的变量名（字母/数字/下划线，不以数字开头） */
export const isValidPromptVariableKey = (key: string) => /^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/.test(key.trim());

const DOUBLE_BRACE_TOKEN = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

/**
 * 将 `{{key}}` 替换为 `values[key]`；未出现在 `values` 中的占位符保持原样。
 */
export const applyPromptVariables = (template: string, values: Record<string, string>) =>
  template.replace(DOUBLE_BRACE_TOKEN, (full, rawKey: string) => {
    const key = rawKey.trim();
    return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : full;
  });

/** 提示词中出现的 `{{key}}` 去重后的 key 列表 */
export const extractDoubleBraceVariableKeys = (text: string): string[] => {
  const keys = new Set<string>();
  const re = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    keys.add(m[1].trim());
  }
  return [...keys];
};

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** 删除提示词中某合法标识对应的 `{{ key }}` 占位（整块删除） */
export const stripDoubleBracePlaceholdersForKey = (template: string, rawKey: string): string => {
  const key = rawKey.trim();
  if (!isValidPromptVariableKey(key)) {
    return template;
  }
  const re = new RegExp(`\\{\\{\\s*${escapeRegExp(key)}\\s*\\}\\}`, 'g');
  return template.replace(re, '');
};

/** 将 `{{oldKey}}` 替换为 `{{newKey}}`（均为合法标识时） */
export const replaceDoubleBraceKeyInPrompt = (template: string, oldKey: string, newKey: string): string => {
  const o = oldKey.trim();
  const n = newKey.trim();
  if (!isValidPromptVariableKey(o) || !isValidPromptVariableKey(n)) {
    return template;
  }
  const re = new RegExp(`\\{\\{\\s*${escapeRegExp(o)}\\s*\\}\\}`, 'g');
  return template.replace(re, `{{${n}}}`);
};

/**
 * 按提示词中 `{{key}}` 首次出现顺序对齐变量行；去掉文中已无的 key；新 key 用 `createId` 建行。
 */
export const syncPromptVariablesToBraceKeys = (
  prompt: string,
  prev: WorkflowChatbotPromptVariable[],
  createId: () => string,
): WorkflowChatbotPromptVariable[] => {
  const keys = extractDoubleBraceVariableKeys(prompt);
  const byKey = new Map(prev.map((r) => [r.key.trim(), r]));
  return keys.map((k) => {
    const ex = byKey.get(k);
    if (ex) {
      return ex;
    }
    return { id: createId(), key: k };
  });
};

/** 出现在文本中但未在已定义集合里的变量 key */
export const findUndefinedVariableKeys = (text: string, definedKeys: Iterable<string>): string[] => {
  const def = new Set(definedKeys);
  return extractDoubleBraceVariableKeys(text).filter((k) => !def.has(k));
};

/**
 * 光标处「单字符触发」：`{…` / `{{…` 或 `/…`（与 `{` 相同补全语义），
 * 不在已闭合的 `{{…}}` 内；`/` 会跳过 `://` 与 `//`。
 */
export const getBraceVariableTrigger = (
  value: string,
  selectionStart: number,
): { start: number; filter: string } | null => {
  const before = value.slice(0, selectionStart);
  for (let i = selectionStart - 1; i >= 0; i--) {
    const ch = before[i];
    if (ch === '{') {
      const slice = before.slice(i);
      if (slice.startsWith('{{')) {
        const inner = slice.slice(2);
        if (inner.includes('}')) {
          continue;
        }
        const pairClose = value.indexOf('}}', i + 2);
        if (pairClose !== -1 && selectionStart <= pairClose + 2) {
          continue;
        }
        return { start: i, filter: inner };
      }
      if (i > 0 && before[i - 1] === '{') {
        continue;
      }
      const inner = slice.slice(1);
      if (inner.includes('}')) {
        continue;
      }
      return { start: i, filter: inner };
    }
    if (ch === '/') {
      if (i > 0 && before[i - 1] === '/') {
        continue;
      }
      if (i > 0 && before[i - 1] === ':') {
        continue;
      }
      const slice = before.slice(i);
      const inner = slice.slice(1);
      if (inner.includes('}')) {
        continue;
      }
      const openBrace = before.lastIndexOf('{{', i);
      if (openBrace !== -1) {
        const innerStart = openBrace + 2;
        const pairClose = value.indexOf('}}', innerStart);
        if (pairClose !== -1 && i < pairClose + 2 && selectionStart <= pairClose + 2) {
          continue;
        }
      }
      return { start: i, filter: inner };
    }
  }
  return null;
};

/** 光标在未闭合的 `{{…` 内（尚无 `}}`）时触发；已闭合占位符内不触发 */
export const getPairInnerTrigger = (
  value: string,
  selectionStart: number,
): { openStart: number; replaceEnd: number; filter: string } | null => {
  let open = -1;
  const hi = Math.min(selectionStart, value.length);
  for (let i = hi - 2; i >= 0; i--) {
    if (value.slice(i, i + 2) === '{{') {
      open = i;
      break;
    }
  }
  if (open < 0 || selectionStart < open + 2) {
    return null;
  }
  const innerStart = open + 2;
  const close = value.indexOf('}}', innerStart);
  if (close === -1) {
    const segment = value.slice(innerStart, selectionStart);
    if (segment.includes('}')) {
      return null;
    }
    return { openStart: open, replaceEnd: selectionStart, filter: segment };
  }
  return null;
};

export type PromptVariableMenuTrigger =
  | { kind: 'single'; start: number; filter: string }
  | { kind: 'pair'; openStart: number; replaceEnd: number; filter: string };

/** 未闭合的 `{{…` 走 pair；已闭合 `{{…}}` 不弹层；单 `{` 或 `/` 走 single */
export const resolvePromptVariableMenuTrigger = (
  value: string,
  selectionStart: number,
): PromptVariableMenuTrigger | null => {
  const pair = getPairInnerTrigger(value, selectionStart);
  if (pair) {
    return { kind: 'pair', ...pair };
  }
  const single = getBraceVariableTrigger(value, selectionStart);
  if (single) {
    return { kind: 'single', start: single.start, filter: single.filter };
  }
  return null;
};

export const normalizePromptVariablesList = (raw: unknown): WorkflowChatbotPromptVariable[] => {
  if (!Array.isArray(raw)) {
    return [];
  }
  const seen = new Set<string>();
  const out: WorkflowChatbotPromptVariable[] = [];
  let index = 0;
  for (const row of raw) {
    if (!row || typeof row !== 'object') {
      continue;
    }
    const r = row as Record<string, unknown>;
    const key = typeof r.key === 'string' ? r.key.trim() : '';
    if (!key) {
      continue;
    }
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    const id = typeof r.id === 'string' && r.id.trim().length > 0 ? r.id.trim() : `pv-${index}-${key}`;
    const label = typeof r.label === 'string' ? r.label.trim() : '';
    out.push({ id, key, label: label.length > 0 ? label : undefined });
    index += 1;
  }
  return out;
};
