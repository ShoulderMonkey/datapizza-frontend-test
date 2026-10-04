import type { CitationReference } from '../types';

/** Two references are the same citation when document, page and quoted text match. */
export function isSameCitation(
  a: CitationReference | null | undefined,
  b: CitationReference | null | undefined
): boolean {
  return (
    !!a && !!b && a.document_id === b.document_id && a.page_number === b.page_number && a.text_quote === b.text_quote
  );
}
