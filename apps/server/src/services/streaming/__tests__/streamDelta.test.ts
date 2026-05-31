import { normalizeStreamDelta } from './streamDelta';

describe('normalizeStreamDelta', () => {
  it('returns only the incremental suffix when provider sends cumulative chunks', () => {
    expect(normalizeStreamDelta('', '中华')).toBe('中华');
    expect(normalizeStreamDelta('中华', '中华人民共和国')).toBe('人民共和国');
    expect(normalizeStreamDelta('中华人民共和国', '中华人民共和国的首都是北京。')).toBe('的首都是北京。');
  });

  it('keeps content unchanged when chunk is already incremental', () => {
    expect(normalizeStreamDelta('中华', '人民共和国')).toBe('人民共和国');
  });

  it('returns empty string for empty chunk', () => {
    expect(normalizeStreamDelta('中华人民共和国', '')).toBe('');
  });
});
