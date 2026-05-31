import { createHash } from 'crypto';

import { generateKnowledgeTextHash } from '../../../knowledgeContentHash.js';

describe('generateKnowledgeTextHash', () => {
  it('matches Dify helper.generate_text_hash', () => {
    const text = '工单渠道为 app，退款由在线客服处理。';
    const expected = createHash('sha256').update(`${text}None`, 'utf8').digest('hex');
    expect(generateKnowledgeTextHash(text)).toBe(expected);
    expect(generateKnowledgeTextHash(text)).toHaveLength(64);
  });
});
