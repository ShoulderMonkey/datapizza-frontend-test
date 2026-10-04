import { describe, it, expect } from 'vitest';
import { inchesRectToPx } from '@/src/features/factcheck/lib/coordinates';

describe('inchesRectToPx', () => {
  it('converts inches to px at 1:1 scale on a 612 pt page (72 px per inch, top-left origin)', () => {
    expect(inchesRectToPx([1, 1, 2, 0.5], 612, 612)).toEqual({ left: 72, top: 72, width: 144, height: 36 });
  });
  it('doubles every value when the page is rendered at twice the width', () => {
    expect(inchesRectToPx([1, 1, 2, 0.5], 612, 1224)).toEqual({ left: 144, top: 144, width: 288, height: 72 });
  });
  it('does not flip the y axis (y grows downwards)', () => {
    expect(inchesRectToPx([0, 0, 1, 1], 612, 612).top).toBe(0);
  });
  it('returns an empty rect for invalid inputs instead of NaN', () => {
    expect(inchesRectToPx([1, 1, 2, 0.5], 0, 612)).toEqual({ left: 0, top: 0, width: 0, height: 0 });
    expect(inchesRectToPx([1, 1, 2, 0.5], 612, 0)).toEqual({ left: 0, top: 0, width: 0, height: 0 });
  });
});
