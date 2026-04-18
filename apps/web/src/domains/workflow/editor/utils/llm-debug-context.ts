export type LlmDebugVariableField = {
  path: string
  label: string
  kind: 'query' | 'text' | 'json'
  required: boolean
}

/** 上次运行调试不展示的手动输入项（附件走 Start 上传，不在此 Mock） */
export const LLM_DEBUG_HIDDEN_PATHS = new Set(['sys.files'])
