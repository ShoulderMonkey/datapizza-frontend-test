'use client';

import { ERROR_MESSAGES } from '@/src/api';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Document, Page } from 'react-pdf';
import type { CitationReference } from '../types';
import { BoundingBoxOverlay } from './BoundingBoxOverlay';
import '../lib/pdfWorker';

interface PdfPageViewProps {
  file: Blob;
  pageNumber: number;
  /** Zoom factor: 1 = 72 dpi (one CSS px per PDF point). */
  scale: number;
  citations: CitationReference[];
  activeCitation?: CitationReference | null;
  onSelectCitation?: (citation: CitationReference) => void;
  onNumPages: (numPages: number) => void;
  onPageWidthPt: (widthPt: number) => void;
  onLoadError: (message: string) => void;
}

/**
 * One rendered PDF page (react-pdf) with the bounding-box overlay.
 * Once the page is drawn, the first highlighted box (preferably of the active
 * citation) is scrolled into view.
 */
export function PdfPageView({
  file,
  pageNumber,
  scale,
  citations,
  activeCitation,
  onSelectCitation,
  onNumPages,
  onPageWidthPt,
  onLoadError,
}: PdfPageViewProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [pageWidthPt, setPageWidthPt] = useState<number>(0);
  const [renderedPage, setRenderedPage] = useState<number | null>(null);

  const options = useMemo(() => ({}), []);

  const scrollToFirstBox = useCallback(() => {
    const root = wrapperRef.current;
    if (!root) return;
    const target =
      root.querySelector<HTMLElement>('[data-testid="bbox"][data-active="true"]') ??
      root.querySelector<HTMLElement>('[data-testid="bbox"]');
    target?.scrollIntoView?.({ block: 'center', inline: 'nearest', behavior: 'smooth' });
  }, []);

  // Scroll when the page is rendered AND whenever the highlighted citation changes.
  useEffect(() => {
    if (renderedPage !== pageNumber) return;
    const frame = requestAnimationFrame(scrollToFirstBox);
    return () => cancelAnimationFrame(frame);
  }, [renderedPage, pageNumber, activeCitation, scrollToFirstBox]);

  return (
    <div ref={wrapperRef} className="relative shadow-2xl rounded bg-white my-auto">
      <Document
        file={file}
        options={options}
        onLoadSuccess={(doc) => onNumPages(doc.numPages)}
        onLoadError={(err) => {
          console.error('react-pdf failed to load the document:', err);
          onLoadError(ERROR_MESSAGES.pdf_render);
        }}
        loading={<div className="p-8 text-sm text-slate-500">Rendering del PDF...</div>}
        error={null}
      >
        <Page
          pageNumber={pageNumber}
          scale={scale}
          renderTextLayer={false}
          renderAnnotationLayer={false}
          onLoadSuccess={(page) => {
            setPageWidthPt(page.originalWidth);
            onPageWidthPt(page.originalWidth);
          }}
          onRenderSuccess={() => setRenderedPage(pageNumber)}
        />
      </Document>
      {pageWidthPt > 0 && (
        <BoundingBoxOverlay
          pageNumber={pageNumber}
          pageWidthPt={pageWidthPt}
          renderedWidthPx={pageWidthPt * scale}
          citations={citations}
          activeCitation={activeCitation}
          onSelectCitation={onSelectCitation}
        />
      )}
    </div>
  );
}
