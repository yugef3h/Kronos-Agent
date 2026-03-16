import { parseTakeoutOrchestrationOutput } from './takeoutOrchestratorService';

describe('takeoutOrchestratorService parser', () => {
  it('parses chat mode output and strips marker', () => {
    const result = parseTakeoutOrchestrationOutput('今天天气不错，记得多喝水。\n[[CHAT]]');

    expect(result.action).toBe('chat');
    expect(result.assistantReply).toBe('今天天气不错，记得多喝水。');
    expect(result.toolCall).toBeUndefined();
  });

  it('parses ask slot mode output', () => {
    const result = parseTakeoutOrchestrationOutput('可以，想吃什么菜？\n[[ASK_SLOT]]');

    expect(result.action).toBe('ask_slot');
    expect(result.assistantReply).toBe('可以，想吃什么菜？');
  });

  it('parses hidden tool call and keeps it out of visible reply', () => {
    const result = parseTakeoutOrchestrationOutput(
      '好的，我来帮你点。\n[[TAKEOUT_TOOL]]{"food":"生椰拿铁"}',
    );

    expect(result.action).toBe('tool_call');
    expect(result.assistantReply).toBe('好的，我来帮你点。');
    expect(result.toolCall).toEqual({
      name: 'takeout',
      params: {
        food: '生椰拿铁',
      },
    });
  });
});
