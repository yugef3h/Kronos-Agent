import type { AIMessage } from '@langchain/core/messages';

export type ModelToolCall = {
  name: string;
  args?: unknown;
};

export const extractModelToolCalls = (message: AIMessage): ModelToolCall[] => {
  const maybeToolCalls = (message as unknown as { tool_calls?: unknown }).tool_calls;

  if (!Array.isArray(maybeToolCalls)) {
    return [];
  }

  return maybeToolCalls
    .map((item): ModelToolCall | null => {
      if (typeof item !== 'object' || item === null) {
        return null;
      }

      const call = item as { name?: unknown; args?: unknown };
      if (typeof call.name !== 'string') {
        return null;
      }

      return {
        name: call.name,
        args: call.args,
      };
    })
    .filter((item): item is ModelToolCall => item !== null);
};
