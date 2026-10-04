'use client';

import { useCallback, useState } from 'react';
import type { CitationReference, PdfViewerTarget } from '../types';

/** State of the fact-check PDF panel: which document/page/citation is open. */
export function usePdfViewer() {
  const [target, setTarget] = useState<PdfViewerTarget | null>(null);

  /**
   * Opens the PDF of `citation`, highlighting every citation of the same document
   * found in `conversationCitations`.
   */
  const inspectCitation = useCallback(
    (citation: CitationReference, conversationCitations: CitationReference[]) => {
      const sameDocument = conversationCitations.filter((c) => c.document_id === citation.document_id);
      setTarget({
        documentId: citation.document_id,
        filename: citation.filename || `Doc-${citation.document_id}`,
        pageNumber: citation.page_number || 1,
        citation,
        allCitations: sameDocument.length > 0 ? sameDocument : [citation],
      });
    },
    []
  );

  /** Opens a document from the library, without citations. */
  const openDocument = useCallback((documentId: string, filename: string) => {
    setTarget({ documentId, filename, pageNumber: 1, citation: null, allCitations: [] });
  }, []);

  const selectCitation = useCallback((citation: CitationReference) => {
    setTarget((prev) => (prev ? { ...prev, citation } : null));
  }, []);

  const close = useCallback(() => setTarget(null), []);

  return { target, inspectCitation, openDocument, selectCitation, close };
}
