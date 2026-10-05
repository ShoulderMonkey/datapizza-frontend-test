import { describe, it, expect } from 'vitest';
import { findPageAtLine, maxPageWidthPt } from '@/src/features/factcheck/lib/pageLayout';

// Three pages of height 100 with a 20 px gap: [0,100] [120,220] [240,340].
const spans = [
  { top: 0, bottom: 100 },
  { top: 120, bottom: 220 },
  { top: 240, bottom: 340 },
];
const spanOf = (i: number) => spans[i];

describe('findPageAtLine', () => {
  it('returns -1 with no pages', () => {
    expect(findPageAtLine(0, spanOf, 10)).toBe(-1);
  });
  it('finds the page containing the line, including edges', () => {
    expect(findPageAtLine(3, spanOf, 50)).toBe(0);
    expect(findPageAtLine(3, spanOf, 120)).toBe(1);
    expect(findPageAtLine(3, spanOf, 220)).toBe(1);
    expect(findPageAtLine(3, spanOf, 300)).toBe(2);
  });
  it('clamps lines above the first and below the last page', () => {
    expect(findPageAtLine(3, spanOf, -500)).toBe(0);
    expect(findPageAtLine(3, spanOf, 9999)).toBe(2);
  });
  it('picks the nearer page when the line falls in a gap', () => {
    expect(findPageAtLine(3, spanOf, 105)).toBe(0);
    expect(findPageAtLine(3, spanOf, 115)).toBe(1);
    expect(findPageAtLine(3, spanOf, 230)).toBe(1);
    expect(findPageAtLine(3, spanOf, 236)).toBe(2);
  });
  it('works with a single page', () => {
    expect(findPageAtLine(1, spanOf, 1000)).toBe(0);
  });
  it('handles long documents reading few spans', () => {
    let reads = 0;
    const idx = findPageAtLine(1000, (i) => { reads++; return { top: i * 110, bottom: i * 110 + 100 }; }, 500 * 110 + 5);
    expect(idx).toBe(500);
    expect(reads).toBeLessThan(40);
  });
});

describe('maxPageWidthPt', () => {
  it('returns 0 for no pages', () => {
    expect(maxPageWidthPt([])).toBe(0);
  });
  it('returns the widest page', () => {
    expect(maxPageWidthPt([{ widthPt: 400, heightPt: 1 }, { widthPt: 612, heightPt: 1 }, { widthPt: 500, heightPt: 1 }])).toBe(612);
  });
});
