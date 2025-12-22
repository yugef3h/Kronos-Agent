import {
  extractToolNamesFromTimeline,
  inferModalitiesBeforeAssistant,
  resolveAssistantInvocation,
} from './assistantInvocation';
import type { LocalChatMessage } from './types';

describe('assistantInvocation', () => {
  it('extracts unique tool names from timeline end events', () => {
    const tools = extractToolNamesFromTimeline([
      {
        eventId: 1,
        stage: 'tool',
        status: 'end',
        message: 'done',
        toolName: 'web_search',
        timestamp: 1,
      },
      {
        eventId: 2,
        stage: 'tool',
        status: 'end',
        message: 'done',
        toolName: 'web_search',
        timestamp: 2,
      },
    ]);

    expect(tools).toEqual(['web_search']);
  });

  it('infers image modality from preceding user upload', () => {
    const messages: LocalChatMessage[] = [
      {
        role: 'user',
        content: '',
        imagePreviewUrl: 'data:image/png;base64,abc',
      },
      { role: 'user', content: '解释图片' },
      { role: 'assistant', content: '识别结果' },
    ];

    expect(inferModalitiesBeforeAssistant(messages, 2)).toEqual(['image']);
    expect(resolveAssistantInvocation(messages[2], messages, 2)?.modalities).toEqual(['image']);
  });
});
