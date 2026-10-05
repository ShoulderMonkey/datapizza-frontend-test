import type { CitationReference } from '../types';

/**
 * Two references are the same citation occurrence when they share `occurrence_key`. Only when
 * either lacks a key (legacy data) does it fall back to document, page and quoted text.
 */
export function isSameCitation(
  a: CitationReference | null | undefined,
  b: CitationReference | null | undefined
): boolean {
  if (a && b && a.occurrence_key && b.occurrence_key) return a.occurrence_key === b.occurrence_key;
  return (
    !!a && !!b && a.document_id === b.document_id && a.page_number === b.page_number && a.text_quote === b.text_quote
  );
}
