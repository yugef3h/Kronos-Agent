import { buildToolRegistry } from './buildToolRegistry.js';
import { describeRegistryTool } from './describeRegistryTool.js';
import type { PlaygroundToolDescriptor } from './describeRegistryTool.js';
import { playgroundToolRegistry } from './playgroundToolRegistry.js';
import type { PlaygroundToolRegistry } from './types.js';
import { listRegistryTools } from './buildToolRegistry.js';

export const listPlaygroundToolDescriptors = (
  registry: PlaygroundToolRegistry = playgroundToolRegistry,
): PlaygroundToolDescriptor[] => (
  listRegistryTools(registry).map((tool) => describeRegistryTool(tool))
);

export const listConfiguredPlaygroundToolDescriptors = (): {
  tools: PlaygroundToolDescriptor[];
  configuredToolNames: string[];
} => {
  const configured = buildToolRegistry({ tavilyApiKey: process.env.TAVILY_API_KEY });
  const configuredToolNames = Object.keys(configured);

  return {
    tools: listPlaygroundToolDescriptors(playgroundToolRegistry),
    configuredToolNames,
  };
};
