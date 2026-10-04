import type { CoordinateOrigin, RectInches } from '../types';

export interface NormalizedRectPercent {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface PixelRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const POINTS_PER_INCH = 72;

/**
 * Converts a bounding rectangle given in inches [x, y, width, height]
 * to percentages relative to the page dimensions (0 to 100%).
 * 
 * @param rect [x, y, width, height] in inches
 * @param pageWidthPt PDF page width in PostScript points (1/72 inch)
 * @param pageHeightPt PDF page height in PostScript points (1/72 inch)
 * @param origin 'top-left' (standard for OCR/extraction tools) or 'bottom-left' (raw PDF stream)
 */
export function inchRectToPercent(
  rect: RectInches,
  pageWidthPt: number,
  pageHeightPt: number,
  origin: CoordinateOrigin = 'top-left'
): NormalizedRectPercent {
  if (!rect || rect.length < 4 || pageWidthPt <= 0 || pageHeightPt <= 0) {
    return { left: 0, top: 0, width: 0, height: 0 };
  }

  const [x, y, w, h] = rect;
  const pageWidthInches = pageWidthPt / POINTS_PER_INCH;
  const pageHeightInches = pageHeightPt / POINTS_PER_INCH;

  const left = (x / pageWidthInches) * 100;
  const width = (w / pageWidthInches) * 100;
  const height = (h / pageHeightInches) * 100;

  let top = (y / pageHeightInches) * 100;
  if (origin === 'bottom-left') {
    // In raw PDF, y is measured from bottom up
    top = ((pageHeightInches - y - h) / pageHeightInches) * 100;
  }

  return {
    left: Math.max(0, left),
    top: Math.max(0, top),
    width: Math.min(100 - Math.max(0, left), Math.max(0, width)),
    height: Math.min(100 - Math.max(0, top), Math.max(0, height)),
  };
}

/**
 * Converts a percentage-based bounding rect into pixel positions
 * for a rendered canvas/container with specific pixel width and height.
 */
export function percentToPixels(
  percent: NormalizedRectPercent,
  containerWidth: number,
  containerHeight: number
): PixelRect {
  return {
    left: (percent.left / 100) * containerWidth,
    top: (percent.top / 100) * containerHeight,
    width: (percent.width / 100) * containerWidth,
    height: (percent.height / 100) * containerHeight,
  };
}
