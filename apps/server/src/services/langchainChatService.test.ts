import { AIMessage } from '@langchain/core/messages';
import { extractModelToolCalls } from './toolCallExtractor';
import { runPlanningStep } from './planningStep';

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

describe('runPlanningStep', () => {
  it('should return no-tool planning decision with elapsed time message', async () => {
    const result = await runPlanningStep({
      invokePlanning: async () =>
        new AIMessage({
          content: 'no tools required',
        }),
      timeoutMs: 200,
    });

    expect(result.timedOut).toBe(false);
    expect(result.modelToolCalls).toEqual([]);
    expect(result.message).toContain('模型决策为无工具调用');
    expect(result.message).toContain('规划耗时');
  });

  it('should skip planning when timeout is reached', async () => {
    const result = await runPlanningStep({
      invokePlanning: () =>
        new Promise<AIMessage>((resolve) => {
          setTimeout(() => {
            resolve(
              new AIMessage({
                content: '',
                tool_calls: [
                  {
                    name: 'token_estimator',
                    args: { text: 'hello world' },
                    id: 'call_timeout',
                    type: 'tool_call',
                  },
                ],
              }),
            );
          }, 30);
        }),
      timeoutMs: 5,
    });

    expect(result.timedOut).toBe(true);
    expect(result.modelToolCalls).toEqual([]);
    expect(result.message).toContain('已跳过工具决策并直接进入推理阶段');
  });

  it('should fallback when planning invocation throws', async () => {
    const result = await runPlanningStep({
      invokePlanning: async () => {
        throw new Error('planner crashed');
      },
      timeoutMs: 200,
    });

    expect(result.timedOut).toBe(false);
    expect(result.modelToolCalls).toEqual([]);
    expect(result.message).toContain('规划器调用失败');
    expect(result.message).toContain('planner crashed');
  });
});
