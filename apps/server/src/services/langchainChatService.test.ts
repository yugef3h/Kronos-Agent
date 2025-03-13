import { AIMessage } from '@langchain/core/messages';
import { extractModelToolCalls } from './toolCallExtractor';

describe('extractModelToolCalls', () => {
  it('should parse model tool calls with name and args', () => {
    const message = new AIMessage({
      content: '',
      tool_calls: [
        {
          name: 'token_estimator',
          args: { text: 'hello world' },
          id: 'call_1',
          type: 'tool_call',
        },
      ],
    });

    const result = extractModelToolCalls(message);
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('token_estimator');
  });

  it('should ignore invalid tool call payload', () => {
    const message = new AIMessage({
      content: '',
      tool_calls: [
        {
          args: { text: 'missing name' },
          id: 'call_2',
          type: 'tool_call',
        } as unknown as { name: string; args: { text: string } },
      ],
    });

    const result = extractModelToolCalls(message);
    expect(result).toEqual([]);
  });
});
