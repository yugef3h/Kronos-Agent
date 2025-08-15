import { normalizeExtractedText } from './fileAnalysisHelpers.js';

const DOC_MIME_TYPE = 'application/msword';
const DOCX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const PDF_MIME_TYPE = 'application/pdf';
const XLS_MIME_TYPE = 'application/vnd.ms-excel';
const XLSX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const TEXT_LIKE_MIME_TYPES = new Set([
  'application/json',
  'application/ld+json',
  'application/x-ndjson',
  'text/csv',
  'text/markdown',
  'text/plain',
]);

const TEXT_LIKE_EXTENSIONS = new Set([
  'csv',
  'json',
  'md',
  'mdx',
  'txt',
  'yaml',
  'yml',
]);

const isTextLikeFile = (mimeType: string, extension: string): boolean => {
  return TEXT_LIKE_MIME_TYPES.has(mimeType) || TEXT_LIKE_EXTENSIONS.has(extension);
};

const extractTextFromPdf = async (buffer: Buffer): Promise<string> => {
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: new Uint8Array(buffer) });

  try {
    const result = await parser.getText();
    return normalizeExtractedText(result.text || '');
  } finally {
    await parser.destroy();
  }
};

const extractTextFromDocx = async (buffer: Buffer): Promise<string> => {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ buffer });
  return normalizeExtractedText(result.value || '');
};

const extractTextFromDoc = async (filePath?: string): Promise<string> => {
  if (!filePath) {
    throw new Error('DOC 文件解析需要先保存到本地');
  }

  const wordExtractorModule = await import('word-extractor');
  const WordExtractor = wordExtractorModule.default;
  const extractor = new WordExtractor();
  const document = await extractor.extract(filePath);
  return normalizeExtractedText(document.getBody() || '');
};

const extractTextFromWorkbook = async (buffer: Buffer): Promise<string> => {
  const xlsx = await import('xlsx');
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  const sheetTexts = workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      return '';
    }

    const rows = xlsx.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
      header: 1,
      raw: false,
      defval: '',
      blankrows: false,
    });

    const content = rows
      .map((row) => row.map((cell) => String(cell ?? '').trim()).filter(Boolean).join(' | '))
      .filter(Boolean)
      .join('\n');

    return content ? `# ${sheetName}\n${content}` : '';
  }).filter(Boolean);

  return normalizeExtractedText(sheetTexts.join('\n\n'));
};

export const extractDocumentText = async (params: {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
  filePath?: string;
}): Promise<string> => {
  const extension = params.fileName.toLowerCase().split('.').pop() || '';

  if (params.mimeType === PDF_MIME_TYPE || extension === 'pdf') {
    return extractTextFromPdf(params.buffer);
  }

  if (params.mimeType === DOCX_MIME_TYPE || extension === 'docx') {
    return extractTextFromDocx(params.buffer);
  }

  if (params.mimeType === DOC_MIME_TYPE || extension === 'doc') {
    return extractTextFromDoc(params.filePath);
  }

  if (
    params.mimeType === XLSX_MIME_TYPE
    || params.mimeType === XLS_MIME_TYPE
    || extension === 'xlsx'
    || extension === 'xls'
  ) {
    return extractTextFromWorkbook(params.buffer);
  }

  if (isTextLikeFile(params.mimeType, extension)) {
    return normalizeExtractedText(params.buffer.toString('utf8'));
  }

  throw new Error('暂仅支持 TXT、DOC、DOCX、PDF、Excel、CSV、MD、JSON 文件');
};