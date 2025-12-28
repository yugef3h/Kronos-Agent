export const PLAYGROUND_MODALITIES = ['image', 'file', 'takeout'] as const;

export type PlaygroundModality = (typeof PLAYGROUND_MODALITIES)[number];

export const PLAYGROUND_TOOL_NAMES = ['web_search'] as const;

export type PlaygroundToolName = (typeof PLAYGROUND_TOOL_NAMES)[number];

export const isPlaygroundToolName = (name: string): name is PlaygroundToolName =>
  (PLAYGROUND_TOOL_NAMES as readonly string[]).includes(name);

export const MODALITY_INVOCATION_LABELS = {
  image: '图片',
  file: '文件',
  takeout: '外卖',
} as const satisfies Record<PlaygroundModality, string>;

export const TOOL_INVOCATION_LABELS = {
  web_search: '网页搜索',
} as const satisfies Record<PlaygroundToolName, string>;
