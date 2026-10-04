import { describe, it, expect } from 'vitest';
import { isSameCitation } from '@/src/features/factcheck/lib/citations';
import type { CitationReference } from '@/src/api';

const base: CitationReference = { document_id: 'd1', filename: 'a.pdf', page_number: 2, text_quote: 'q' };

describe('isSameCitation', () => {
  it('matches equal document, page and quote even for distinct objects', () => {
    expect(isSameCitation(base, { ...base, filename: 'other.pdf' })).toBe(true);
  });
  it('distinguishes by document, page and quote', () => {
    expect(isSameCitation(base, { ...base, document_id: 'd2' })).toBe(false);
    expect(isSameCitation(base, { ...base, page_number: 3 })).toBe(false);
    expect(isSameCitation(base, { ...base, text_quote: 'z' })).toBe(false);
  });
  it('is false when either side is null/undefined (no citation active)', () => {
    expect(isSameCitation(null, base)).toBe(false);
    expect(isSameCitation(base, undefined)).toBe(false);
    expect(isSameCitation(null, null)).toBe(false);
  });
});
