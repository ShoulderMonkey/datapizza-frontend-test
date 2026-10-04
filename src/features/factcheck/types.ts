import type { CitationReference } from '@/src/api';
export type { BoundingRegion, CitationReference, RectInches, AsyncStatus } from '@/src/api';

/** Origin of the bounding-box coordinates. The backend uses top-left (docs/AUDIT.md §2). */
export type CoordinateOrigin = 'top-left' | 'bottom-left';

/** What the fact-check PDF viewer is showing. */
export interface PdfViewerTarget {
  documentId: string;
  filename: string;
  /** 1-based. */
  pageNumber: number;
  citation: CitationReference | null;
  allCitations: CitationReference[];
}

/** Minimal structural view of a pdf.js page (PDFPageProxy). */
export interface PdfPageLike {
  getViewport(opts: { scale: number }): { width: number; height: number };
  render(params: unknown): { promise: Promise<void> };
}

/** Minimal structural view of a pdf.js document (PDFDocumentProxy). */
export interface PdfDocumentLike {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPageLike>;
}
