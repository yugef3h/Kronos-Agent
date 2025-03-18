import {
  buildFileAnalyzeUserMessage,
  getFileExtension,
  inferSupportedFileMimeType,
  isFileSizeAllowed,
  isSupportedFileExtension,
} from './helpers';

describe('file helpers', () => {
  it('reads extension from filename', () => {
    expect(getFileExtension('report.final.PDF')).toBe('pdf');
  });

  it('accepts supported extensions', () => {
    expect(isSupportedFileExtension('docx')).toBe(true);
    expect(isSupportedFileExtension('zip')).toBe(false);
  });

  it('infers mime type from extension', () => {
    expect(inferSupportedFileMimeType('', 'md')).toBe('text/markdown');
    expect(inferSupportedFileMimeType('', 'pdf')).toBe('application/pdf');
  });

  it('builds file analyze user message', () => {
    expect(buildFileAnalyzeUserMessage({ fileName: '需求文档.md', prompt: '请总结重点' })).toBe(
      '文件解读：需求文档.md\n补充说明：请总结重点',
    );
  });

  it('checks file size', () => {
    expect(isFileSizeAllowed(1024)).toBe(true);
    expect(isFileSizeAllowed(9 * 1024 * 1024)).toBe(false);
  });
});