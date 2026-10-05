'use client';

import { memo, useCallback } from 'react';
import { Page } from 'react-pdf';
import type { PDFDocumentProxy } from 'pdfjs-dist';
// Styles of the selectable text layer (positions the transparent spans over the canvas).
import 'react-pdf/dist/Page/TextLayer.css';
import type { CitationReference } from '../types';
import type { PageSize } from '../lib/pageLayout';
import { BoundingBoxOverlay } from './BoundingBoxOverlay';

interface PdfPageSlotProps {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  size: PageSize;
  scale: number;
  /** false: only the sized placeholder (and the overlay) is in the DOM, no canvas/text layer. */
  shouldRender: boolean;
  citations: CitationReference[];
  activeCitation?: CitationReference | null;
  onSelectCitation?: (citation: CitationReference) => void;
  registerElement: (pageNumber: number, element: HTMLDivElement | null) => void;
  onRendered: (pageNumber: number) => void;
}

/**
 * One page of the continuous viewer. The box always has the final size of the page
 * (size in points x zoom), rendered or not, so the column height never changes when a page is
 * drawn or released. The bounding-box overlay is laid over the box in both states, which lets the
 * viewer scroll to a region of a page that is not drawn yet.
 *
 * Layers, bottom to top: canvas, text layer (transparent, selectable spans), overlay. The overlay
 * is `pointer-events: none` except on each bbox button, so the text outside them stays selectable.
 * The annotation layer is off: the documents are plain reports, and its links/forms would add
 * tab stops and styles without serving the fact-checking flow.
 */
export const PdfPageSlot = memo(function PdfPageSlot({
  pdf,
  pageNumber,
  size,
  scale,
  shouldRender,
  citations,
  activeCitation,
  onSelectCitation,
  registerElement,
  onRendered,
}: PdfPageSlotProps) {
  const widthPx = size.widthPt * scale;
  const heightPx = size.heightPt * scale;
  const ref = useCallback(
    (element: HTMLDivElement | null) => registerElement(pageNumber, element),
    [registerElement, pageNumber]
  );

  return (
    <div
      ref={ref}
      data-testid="pdf-page"
      data-page-number={pageNumber}
      data-rendered={shouldRender ? 'true' : 'false'}
      className="relative mx-auto shrink-0 scroll-mt-4 rounded bg-white shadow-2xl"
      style={{ width: widthPx, height: heightPx }}
    >
      {shouldRender ? (
        <Page
          pdf={pdf}
          pageNumber={pageNumber}
          scale={scale}
          renderTextLayer
          renderAnnotationLayer={false}
          // Effect-based loading: a suspending page would hide the whole column behind the
          // next/dynamic Suspense boundary.
          suspense={false}
          loading={null}
          error={null}
          onRenderSuccess={() => onRendered(pageNumber)}
          onRenderError={(err) => {
            console.error(`react-pdf failed to render page ${pageNumber}:`, err);
            onRendered(pageNumber);
          }}
        />
      ) : (
        <span
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center text-xs text-slate-400 select-none"
        >
          {pageNumber}
        </span>
      )}
      <BoundingBoxOverlay
        pageNumber={pageNumber}
        pageWidthPt={size.widthPt}
        renderedWidthPx={widthPx}
        citations={citations}
        activeCitation={activeCitation}
        onSelectCitation={onSelectCitation}
      />
    </div>
  );
});
