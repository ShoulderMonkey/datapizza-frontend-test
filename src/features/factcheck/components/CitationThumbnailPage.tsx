'use client';

import { Document, Page } from 'react-pdf';
import type { CitationReference } from '../types';
import { inchesRectToPx } from '../lib/coordinates';
import '../lib/pdfWorker';

export const THUMBNAIL_PAGE_WIDTH_PX = 140;

interface CitationThumbnailPageProps {
  file: Blob;
  citation: CitationReference;
  pageWidthPt: number;
  onPageWidth: (widthPt: number) => void;
  onRendered: () => void;
  onFail: (err: unknown) => void;
}

/** Client-only part of the thumbnail (react-pdf touches window at import time: load with ssr:false). */
export function CitationThumbnailPage({
  file,
  citation,
  pageWidthPt,
  onPageWidth,
  onRendered,
  onFail,
}: CitationThumbnailPageProps) {
  const rects: ReturnType<typeof inchesRectToPx>[] = [];
  if (pageWidthPt > 0) {
    for (const region of citation.bounding_regions ?? []) {
      if (region.page_number !== citation.page_number || !Array.isArray(region.rects_in)) continue;
      for (const rect of region.rects_in) {
        if (Array.isArray(rect) && rect.length >= 4) {
          rects.push(inchesRectToPx(rect, pageWidthPt, THUMBNAIL_PAGE_WIDTH_PX));
        }
      }
    }
  }

  return (
    <span className="relative block bg-white" style={{ width: THUMBNAIL_PAGE_WIDTH_PX }}>
      <Document file={file} loading={null} error={null} onLoadError={onFail}>
        <Page
          pageNumber={citation.page_number}
          width={THUMBNAIL_PAGE_WIDTH_PX}
          renderTextLayer={false}
          renderAnnotationLayer={false}
          loading={null}
          error={null}
          onLoadSuccess={(page) => onPageWidth(page.originalWidth)}
          onRenderSuccess={onRendered}
          onLoadError={onFail}
          onRenderError={onFail}
        />
      </Document>
      {rects.map((px, index) => (
        <span
          key={index}
          data-testid="thumbnail-rect"
          style={{ left: px.left, top: px.top, width: px.width, height: px.height }}
          className="absolute border border-amber-500 bg-amber-400/30"
        />
      ))}
    </span>
  );
}
