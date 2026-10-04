import type { CitationReference } from '@/src/api';
export type { BoundingRegion, CitationReference, RectInches, AsyncStatus } from '@/src/api';

/** What the fact-check PDF viewer is showing. */
export interface PdfViewerTarget {
  documentId: string;
  filename: string;
  /** 1-based. */
  pageNumber: number;
  citation: CitationReference | null;
  allCitations: CitationReference[];
}
