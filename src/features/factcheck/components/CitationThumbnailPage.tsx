'use client';

import { useEffect, useState } from 'react';
import { Page } from 'react-pdf';
import type { CitationReference } from '../types';
import { inchesRectToPx } from '../lib/coordinates';
import { useDocumentProxy } from '../hooks/useDocumentProxy';

/** Fixed thumbnail box (also the placeholder size: no layout shift when the page appears). */
export const THUMBNAIL_BOX_WIDTH_PX = 140;
export const THUMBNAIL_BOX_HEIGHT_PX = 180;

/** "object-fit: contain": the whole page fits the box, whatever its orientation. */
export function fitScale(pageWidthPt: number, pageHeightPt: number): number {
  if (!(pageWidthPt > 0) || !(pageHeightPt > 0)) return 0;
  return Math.min(THUMBNAIL_BOX_WIDTH_PX / pageWidthPt, THUMBNAIL_BOX_HEIGHT_PX / pageHeightPt);
}

interface CitationThumbnailPageProps {
  file: Blob;
  citation: CitationReference;
  onRendered: () => void;
  onFail: (err: unknown) => void;
}

interface PageSize {
  widthPt: number;
  heightPt: number;
}

/**
 * Client-only part of the thumbnail (react-pdf touches window at import time: load with ssr:false).
 * The pdf.js document is parsed once per document_id (useDocumentProxy) and shared by every card.
 */
export function CitationThumbnailPage({
  file,
  citation,
  onRendered,
  onFail,
}: CitationThumbnailPageProps) {
  const proxyQuery = useDocumentProxy(citation.document_id, file);
  const pdf = proxyQuery.data;
  const [size, setSize] = useState<PageSize | null>(null);

  useEffect(() => {
    if (proxyQuery.isError) onFail(proxyQuery.error);
  }, [proxyQuery.isError, proxyQuery.error, onFail]);

  useEffect(() => {
    if (!pdf) return;
    let cancelled = false;
    pdf
      .getPage(citation.page_number)
      .then((page) => {
        if (cancelled) return;
        const viewport = page.getViewport({ scale: 1 });
        setSize({ widthPt: viewport.width, heightPt: viewport.height });
      })
      .catch((err: unknown) => {
        if (!cancelled) onFail(err);
      });
    return () => {
      cancelled = true;
    };
  }, [pdf, citation.page_number, onFail]);

  if (!pdf || !size) return null;

  const scale = fitScale(size.widthPt, size.heightPt);
  const widthPx = size.widthPt * scale;
  const heightPx = size.heightPt * scale;

  const rects: ReturnType<typeof inchesRectToPx>[] = [];
  for (const region of citation.bounding_regions ?? []) {
    if (region.page_number !== citation.page_number || !Array.isArray(region.rects_in)) continue;
    for (const rect of region.rects_in) {
      if (Array.isArray(rect) && rect.length >= 4) {
        rects.push(inchesRectToPx(rect, size.widthPt, widthPx));
      }
    }
  }

  return (
    <span
      data-testid="thumbnail-page"
      className="absolute left-1/2 top-1/2 block -translate-x-1/2 -translate-y-1/2 bg-white"
      style={{ width: widthPx, height: heightPx }}
    >
      <Page
        pdf={pdf}
        pageNumber={citation.page_number}
        scale={scale}
        renderTextLayer={false}
        renderAnnotationLayer={false}
        loading={null}
        error={null}
        onRenderSuccess={onRendered}
        onLoadError={onFail}
        onRenderError={onFail}
      />
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
