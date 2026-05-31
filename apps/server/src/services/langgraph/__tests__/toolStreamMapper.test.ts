import { describe, expect, it } from '@jest/globals';
import { AIMessage, ToolMessage } from '@langchain/core/messages';
import { mapLangGraphUpdateToTimelineEvents } from '../toolStreamMapper';

describe('mapLangGraphUpdateToTimelineEvents', () => {
  it('emits tool start on agent tool_calls', () => {
    const events = mapLangGraphUpdateToTimelineEvents('agent', [
      new AIMessage({
        content: '',
        tool_calls: [
          {
            name: 'web_search',
            args: { query: 'ai news' },
            id: 'call_1',
            type: 'tool_call',
          },
        ],
      }),
    ]);

    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe('timeline');
    if (events[0]?.type === 'timeline') {
      expect(events[0].stage).toBe('tool');
      expect(events[0].status).toBe('start');
      expect(events[0].toolName).toBe('web_search');
    }
  });

  it('emits tool end on tools node', () => {
    const events = mapLangGraphUpdateToTimelineEvents('tools', [
      new ToolMessage({
        content: 'result body',
        tool_call_id: 'call_1',
        name: 'web_search',
      }),
    ]);

    expect(events).toHaveLength(1);
    if (events[0]?.type === 'timeline') {
      expect(events[0].status).toBe('end');
      expect(events[0].toolOutput).toContain('result body');
    }
  });
});
