import {
  buildImageAnalyzeUserMessage,
  getCompressedImageDimensions,
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

  it('limits the longest image edge to 800px while preserving aspect ratio', () => {
    expect(getCompressedImageDimensions(1600, 1200)).toEqual({ width: 800, height: 600 });
    expect(getCompressedImageDimensions(1200, 1600)).toEqual({ width: 600, height: 800 });
    expect(getCompressedImageDimensions(640, 480)).toEqual({ width: 640, height: 480 });
  });

  it('rejects invalid image dimensions', () => {
    expect(() => getCompressedImageDimensions(0, 1200)).toThrow('图片尺寸无效，请重试');
  });

  it('builds user message with optional prompt', () => {
    expect(buildImageAnalyzeUserMessage({ fileName: 'cat.png', prompt: '' })).toBe('图片识别：cat.png');
    expect(buildImageAnalyzeUserMessage({ fileName: 'cat.png', prompt: '这是午餐，帮我识别热量' }))
      .toBe('图片识别：cat.png\n补充说明：这是午餐，帮我识别热量');
  });
});
