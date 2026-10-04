import { describe, it, expect } from 'vitest';
import { getPagesWithRegions, getFirstRegionPage } from '@/src/features/factcheck/lib/regions';
import type { CitationReference } from '@/src/api';

const cit = (page: number, regions: Array<[number, number[][]]>): CitationReference => ({
  document_id: 'd1', filename: 'a.pdf', page_number: page, text_quote: 'q',
  bounding_regions: regions.map(([page_number, rects_in]) => ({ page_number, rects_in })) as CitationReference['bounding_regions'],
});

describe('getPagesWithRegions', () => {
  it('returns sorted, de-duplicated pages with at least one rect', () => {
    const c = [cit(5, [[5, [[1, 1, 1, 1]]], [2, [[1, 1, 1, 1]]]]), cit(2, [[2, [[0, 0, 1, 1]]]])];
    expect(getPagesWithRegions(c)).toEqual([2, 5]);
  });
  it('ignores regions without rects and citations without regions', () => {
    const c = [cit(3, [[3, []]]), { document_id: 'd', filename: 'f', page_number: 1, text_quote: 'x' }];
    expect(getPagesWithRegions(c)).toEqual([]);
  });
});

describe('getFirstRegionPage', () => {
  it('uses bounding_regions[0].page_number, not the numerically smallest page', () => {
    expect(getFirstRegionPage(cit(1, [[5, [[1, 1, 1, 1]]], [2, [[1, 1, 1, 1]]]]))).toBe(5);
  });
  it('falls back to page_number, and to null without citation', () => {
    expect(getFirstRegionPage({ document_id: 'd', filename: 'f', page_number: 4, text_quote: 'x' })).toBe(4);
    expect(getFirstRegionPage(null)).toBeNull();
  });
});
