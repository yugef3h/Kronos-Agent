import { STAGE_LABEL_MAP } from '../constants';
import { summarizeTimelineHeader } from './chatTimelineFoldUtils.js';

describe('summarizeTimelineHeader', () => {
  it('shows active placeholder when streaming without events', () => {
    expect(summarizeTimelineHeader([], undefined, STAGE_LABEL_MAP, true)).toBe('Agent 处理中…');
  });

  it('prefers current message text', () => {
    expect(
      summarizeTimelineHeader(
        [],
        {
          stage: 'tool',
          status: 'start',
          message: '工具 web_search 开始执行。',
          eventId: 1,
          timestamp: 0,
          toolName: 'web_search',
        },
        STAGE_LABEL_MAP,
        true,
      ),
    ).toBe('工具 · 工具 web_search 开始执行。');
  });
});
