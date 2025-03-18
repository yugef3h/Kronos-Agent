import {
  extractFileAnalysisReply,
  normalizeExtractedText,
  parseFileDataUrl,
} from './fileAnalysisHelpers';

describe('fileAnalysisService helpers', () => {
  it('reads array response text', () => {
    const reply = extractFileAnalysisReply({
      choices: [
        {
          message: {
            content: [
              { type: 'output_text', text: '这是合同摘要。' },
              { type: 'output_text', text: '需关注付款条款。' },
            ],
          },
        },
      ],
    });

    expect(reply).toBe('这是合同摘要。需关注付款条款。');
  });

  it('parses data url payload', () => {
    const payload = parseFileDataUrl('data:text/plain;base64,5L2g5aW9');

    expect(payload.mimeType).toBe('text/plain');
    expect(payload.buffer.toString('utf8')).toBe('你好');
  });

  it('normalizes whitespace from extracted text', () => {
    const normalized = normalizeExtractedText('第一行\r\n\r\n\r\n第二行\u0000');
    expect(normalized).toBe('第一行\n\n第二行');
  });
});