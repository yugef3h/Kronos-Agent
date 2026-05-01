import { createHash } from 'crypto';

/**
 * 与 Dify `api/libs/helper.py::generate_text_hash` 一致：
 * SHA256( str(text) + "None" )，用于 segment / 文档正文去重。
 */
export const generateKnowledgeTextHash = (text: string): string =>
  createHash('sha256').update(`${String(text)}None`, 'utf8').digest('hex');

/** 文档级：对入库前的预处理全文（即 parsed/content.txt）算 hash */
export const computeKnowledgeDocumentContentHash = (processedText: string): string =>
  generateKnowledgeTextHash(processedText);
