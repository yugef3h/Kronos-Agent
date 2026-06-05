import type { StructuredToolInterface } from '@langchain/core/tools';

import { invokePlaygroundToolWithHarness } from './toolHarness.js';

const isHarnessEnabled = (): boolean =>
  (process.env.TOOL_HARNESS_ENABLED ?? 'true').trim().toLowerCase() !== 'false';

export const wrapToolWithHarness = (tool: StructuredToolInterface): StructuredToolInterface => {
  if (!isHarnessEnabled()) {
    return tool;
  }

  type ToolInvoke = StructuredToolInterface['invoke'];
  const harnessInvoke: ToolInvoke = async (
    input: Parameters<ToolInvoke>[0],
    config?: Parameters<ToolInvoke>[1],
  ): Promise<unknown> => {
    const normalizedInput = typeof input === 'object' && input !== null
      ? input as Record<string, unknown>
      : { input };

    return invokePlaygroundToolWithHarness(tool, normalizedInput);
  };

  return Object.create(tool, {
    invoke: { value: harnessInvoke },
  });
};

export const wrapToolsWithHarness = (tools: StructuredToolInterface[]): StructuredToolInterface[] => (
  tools.map((tool) => wrapToolWithHarness(tool))
);
