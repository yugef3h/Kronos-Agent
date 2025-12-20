import type { StructuredToolInterface } from '@langchain/core/tools';

/** Playground 工具名；新增工具时在此扩展并在 buildToolRegistry 注册。 */
export type PlaygroundToolName = 'web_search';

export type PlaygroundToolRegistry = Partial<Record<PlaygroundToolName, StructuredToolInterface>>;
