import type { StructuredToolInterface } from '@langchain/core/tools';

import { WEB_SEARCH_TOOL_NAME } from './tavilyWebSearchTool.js';

export type ToolHarnessValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

const MAX_TOOL_OUTPUT_CHARS = Number(process.env.TOOL_HARNESS_MAX_OUTPUT_CHARS ?? '8000');
const MAX_TOOL_RETRIES = Number(process.env.TOOL_HARNESS_MAX_RETRIES ?? '1');

const isHarnessEnabled = (): boolean =>
  (process.env.TOOL_HARNESS_ENABLED ?? 'true').trim().toLowerCase() !== 'false';

export const validateToolInvokeInput = (
  toolName: string,
  input: Record<string, unknown>,
): ToolHarnessValidationResult => {
  if (toolName === WEB_SEARCH_TOOL_NAME) {
    const query = typeof input.query === 'string' ? input.query.trim() : '';
    if (!query) {
      return { ok: false, reason: 'web_search requires a non-empty query' };
    }
  }

  const serialized = JSON.stringify(input);
  if (serialized.length > 4000) {
    return { ok: false, reason: `tool input exceeds 4000 chars (${serialized.length})` };
  }

  return { ok: true };
};

export const validateToolInvokeOutput = (
  _toolName: string,
  output: unknown,
): ToolHarnessValidationResult => {
  const serialized = typeof output === 'string' ? output : JSON.stringify(output ?? '');

  if (!serialized.trim()) {
    return { ok: false, reason: 'tool output is empty' };
  }

  if (serialized.length > MAX_TOOL_OUTPUT_CHARS) {
    return {
      ok: false,
      reason: `tool output exceeds ${MAX_TOOL_OUTPUT_CHARS} chars (${serialized.length})`,
    };
  }

  if (/^web_search:\s*empty query$/i.test(serialized.trim())) {
    return { ok: false, reason: 'tool returned empty-query sentinel' };
  }

  return { ok: true };
};

export const invokePlaygroundToolWithHarness = async (
  tool: StructuredToolInterface,
  input: Record<string, unknown>,
): Promise<unknown> => {
  if (!isHarnessEnabled()) {
    return tool.invoke(input);
  }

  let lastReason = 'unknown harness failure';

  for (let attempt = 0; attempt <= MAX_TOOL_RETRIES; attempt += 1) {
    const inputValidation = validateToolInvokeInput(tool.name, input);
    if (!inputValidation.ok) {
      lastReason = inputValidation.reason;
      if (attempt >= MAX_TOOL_RETRIES) {
        throw new Error(`[tool-harness] input blocked: ${lastReason}`);
      }
      continue;
    }

    const output = await tool.invoke(input);
    const outputValidation = validateToolInvokeOutput(tool.name, output);
    if (outputValidation.ok) {
      return output;
    }

    lastReason = outputValidation.reason;
    if (attempt >= MAX_TOOL_RETRIES) {
      throw new Error(`[tool-harness] output blocked: ${lastReason}`);
    }
  }

  throw new Error(`[tool-harness] failed: ${lastReason}`);
};
