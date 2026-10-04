import type { RectInches } from '../types';

export interface PixelRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** PDF points (PostScript) per inch. */
export const POINTS_PER_INCH = 72;

/**
 * Converts a backend bounding rectangle into pixels relative to the rendered page.
 *
 * Coordinate system: the origin is the TOP-LEFT corner of the page and `y` grows
 * DOWNWARDS (BE:tests/bbox_visualization.py:48, docs/AUDIT.md §2), so no axis flip is needed.
 *
 * inches x 72 = PDF points; points x (renderedWidthPx / pageWidthPt) = pixels.
 * The same factor is used for both axes (the page keeps its aspect ratio).
 *
 * @param rect [x, y, width, height] in inches
 * @param pageWidthPt unscaled page width in points
 * @param renderedWidthPx width of the page as rendered on screen, in CSS pixels
 */
export function inchesRectToPx(
  rect: RectInches,
  pageWidthPt: number,
  renderedWidthPx: number
): PixelRect {
  if (!rect || rect.length < 4 || !(pageWidthPt > 0) || !(renderedWidthPx > 0)) {
    return { left: 0, top: 0, width: 0, height: 0 };
  }
  const factor = (POINTS_PER_INCH * renderedWidthPx) / pageWidthPt;
  const [x, y, w, h] = rect;
  return { left: x * factor, top: y * factor, width: w * factor, height: h * factor };
}
