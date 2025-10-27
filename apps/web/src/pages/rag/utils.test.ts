import { getDatasetExtensionBadge } from './utils.js';

describe('rag utils', () => {
  it('returns DOC when dataset has no imported document extension', () => {
    expect(getDatasetExtensionBadge()).toBe('DOC');
    expect(getDatasetExtensionBadge([])).toBe('DOC');
  });

  it('returns a normalized single extension badge', () => {
    expect(getDatasetExtensionBadge(['.Pdf'])).toBe('PDF');
    expect(getDatasetExtensionBadge(['xlsx'])).toBe('XLSX');
  });

  it('returns MIX when dataset contains multiple extensions', () => {
    expect(getDatasetExtensionBadge(['pdf', '.docx'])).toBe('MIX');
  });
});
