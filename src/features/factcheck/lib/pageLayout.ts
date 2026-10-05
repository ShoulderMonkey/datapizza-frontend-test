/** Size of a PDF page at scale 1, in PDF points (1 pt = 1 CSS px at zoom 1). */
export interface PageSize {
  widthPt: number;
  heightPt: number;
}

/** Vertical extent of a laid-out page, in any coordinate space shared with `y`. */
export interface VerticalSpan {
  top: number;
  bottom: number;
}

/**
 * 0-based index of the page that contains the horizontal line `y`, for pages stacked top to bottom
 * (non-overlapping, ascending `top`). When `y` falls in the gap between two pages the nearer one
 * wins; above the first page it is 0, below the last page it is `count - 1`. Returns -1 when
 * `count` is 0. Binary search: O(log n) reads of `spanOf`, so it can run on every scroll frame
 * even for long documents.
 */
export function findPageAtLine(count: number, spanOf: (index: number) => VerticalSpan, y: number): number {
  if (count <= 0) return -1;
  // First page whose bottom is at or below y.
  let lo = 0;
  let hi = count - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (spanOf(mid).bottom < y) lo = mid + 1;
    else hi = mid;
  }
  const span = spanOf(lo);
  if (y >= span.top || lo === 0) return lo;
  // y is in the gap above page `lo`: pick the nearer of `lo - 1` and `lo`.
  const previous = spanOf(lo - 1);
  return y - previous.bottom <= span.top - y ? lo - 1 : lo;
}

/** The widest page: fit-to-width uses it so that every page of the column fits the container. */
export function maxPageWidthPt(sizes: PageSize[]): number {
  return sizes.reduce((max, size) => Math.max(max, size.widthPt), 0);
}
