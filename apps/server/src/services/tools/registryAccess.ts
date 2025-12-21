import type { StructuredToolInterface } from '@langchain/core/tools';
import type { PlaygroundToolName, PlaygroundToolRegistry } from './types.js';
import { isPlaygroundToolName } from './toolNames.js';

export const getRegistryTool = (
  registry: PlaygroundToolRegistry,
  name: string,
): StructuredToolInterface | undefined => {
  if (!isPlaygroundToolName(name)) {
    return undefined;
  }

  return registry[name];
};

export const invokePlaygroundTool = async (
  tool: StructuredToolInterface,
  input: Record<string, unknown>,
): Promise<unknown> => {
  return tool.invoke(input);
};

export type { PlaygroundToolName };
