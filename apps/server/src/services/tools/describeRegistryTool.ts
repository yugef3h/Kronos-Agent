import type { StructuredToolInterface } from '@langchain/core/tools';
import type { ZodTypeAny } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

export type PlaygroundToolDescriptor = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  enabled: boolean;
};

const serializeToolParameters = (tool: StructuredToolInterface): Record<string, unknown> => {
  if (!('schema' in tool) || !tool.schema) {
    return { type: 'object', properties: {} };
  }

  try {
    return zodToJsonSchema(tool.schema as ZodTypeAny) as Record<string, unknown>;
  } catch {
    return { type: 'object', properties: {} };
  }
};

export const describeRegistryTool = (tool: StructuredToolInterface): PlaygroundToolDescriptor => ({
  name: tool.name,
  description: tool.description,
  parameters: serializeToolParameters(tool),
  enabled: true,
});
