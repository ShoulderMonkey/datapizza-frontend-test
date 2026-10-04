/**
 * Bounding rectangle coordinate tuple: [x, y, width, height] in inches.
 * Typically measured with origin at the top-left of the page.
 */
export type RectInches = [x: number, y: number, width: number, height: number];

export interface BoundingRegion {
  page_number: number;
  rects_in: RectInches[];
}

export interface CitationReference {
  document_id: string;
  filename: string;
  page_number: number;
  text_quote: string;
  bounding_regions?: BoundingRegion[];
}

export interface CitationsChunk {
  type: 'citations';
  references: CitationReference[];
}
