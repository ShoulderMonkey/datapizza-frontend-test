'use client';

import { useEffect, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { PageSize } from '../lib/pageLayout';

type PageSizesState =
  | { status: 'loading' }
  | { status: 'success'; sizes: PageSize[] }
  | { status: 'error'; error: unknown };

/**
 * Reads the size (scale 1, in points, page rotation included) of EVERY page of `pdf` without
 * rendering anything: `getPage` + `getViewport` only exchange metadata with the pdf.js worker.
 * The continuous viewer uses them to size the placeholders of the pages that are not rendered
 * yet, so the column has its final height from the start and scrolling never jumps.
 * `pdf` must not change during the lifetime of the component (the caller is keyed by document).
 */
export function usePdfPageSizes(pdf: PDFDocumentProxy): PageSizesState {
  const [state, setState] = useState<PageSizesState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    const pageNumbers = Array.from({ length: pdf.numPages }, (_, index) => index + 1);
    Promise.all(
      pageNumbers.map((pageNumber) =>
        pdf.getPage(pageNumber).then((page) => {
          const viewport = page.getViewport({ scale: 1 });
          return { widthPt: viewport.width, heightPt: viewport.height };
        })
      )
    )
      .then((sizes) => {
        if (!cancelled) setState({ status: 'success', sizes });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ status: 'error', error });
      });
    return () => {
      cancelled = true;
    };
  }, [pdf]);

  return state;
}
