import type { CitationReference } from '../types';

/** Sorted, de-duplicated 1-based pages on which the citations have at least one rect. */
export function getPagesWithRegions(citations: CitationReference[]): number[] {
  const pages = new Set<number>();
  for (const citation of citations) {
    for (const region of citation.bounding_regions ?? []) {
      if (region.rects_in?.length > 0) pages.add(region.page_number);
    }
  }
  return [...pages].sort((a, b) => a - b);
}

/** Page (1-based) of the first bounding region of a citation, falling back to `page_number`. */
export function getFirstRegionPage(citation: CitationReference | null | undefined): number | null {
  if (!citation) return null;
  return citation.bounding_regions?.[0]?.page_number ?? citation.page_number ?? null;
}
