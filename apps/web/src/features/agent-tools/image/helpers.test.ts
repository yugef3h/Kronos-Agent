import {
  buildImageAnalyzeUserMessage,
  isImageSizeAllowed,
  isSupportedImageMimeType,
} from './helpers';

describe('image helpers', () => {
  it('supports expected image mime types', () => {
    expect(isSupportedImageMimeType('image/jpeg')).toBe(true);
    expect(isSupportedImageMimeType('image/png')).toBe(true);
    expect(isSupportedImageMimeType('image/webp')).toBe(true);
    expect(isSupportedImageMimeType('image/gif')).toBe(false);
  });

  it('validates image size threshold', () => {
    expect(isImageSizeAllowed(1)).toBe(true);
    expect(isImageSizeAllowed(5 * 1024 * 1024)).toBe(true);
    expect(isImageSizeAllowed(0)).toBe(false);
    expect(isImageSizeAllowed(5 * 1024 * 1024 + 1)).toBe(false);
  });

  it('builds user message with optional prompt', () => {
    expect(buildImageAnalyzeUserMessage({ fileName: 'cat.png', prompt: '' })).toBe('图片识别：cat.png');
    expect(buildImageAnalyzeUserMessage({ fileName: 'cat.png', prompt: '这是午餐，帮我识别热量' }))
      .toBe('图片识别：cat.png\n补充说明：这是午餐，帮我识别热量');
  });
});
