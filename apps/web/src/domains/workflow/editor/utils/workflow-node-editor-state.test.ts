import {
  mergePanelDebugDraft,
  readEditorStateFromDslNodeData,
  serializeEditorStateForDsl,
} from './workflow-node-editor-state'
describe('workflow-node-editor-state', () => {
  it('merges stored panel debug draft over defaults', () => {
    const defaults = { contextJson: '{}' }
    expect(mergePanelDebugDraft(defaults, undefined)).toEqual({
      contextJson: '{}',
    })
    expect(
      mergePanelDebugDraft(defaults, {
        contextJson: '{"topic":"ai"}',
      }),
    ).toEqual({
      contextJson: '{"topic":"ai"}',
    })
  })

  it('round-trips panelDebugDraft through DSL node data editor field', () => {
    const draft = { 'sys.query': 'hello' }
    const editor = serializeEditorStateForDsl(draft)
    expect(editor).toEqual({ panelDebugDraft: draft })

    const restored = readEditorStateFromDslNodeData({
      type: 'llm',
      title: 'LLM',
      editor,
    })

    expect(restored?.panelDebugDraft).toEqual(draft)
  })
})
