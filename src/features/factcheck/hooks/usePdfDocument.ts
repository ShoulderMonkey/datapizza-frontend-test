'use client';

import { useEffect, useState } from 'react';
import { documentService, isAbortError, logError, toUserMessage } from '@/src/api';
import type { AsyncStatus } from '../types';


interface PdfDocumentState {
  status: AsyncStatus;
  loadingMessage: string;
  error: string | null;
  /** Downloaded PDF, handed to react-pdf (which owns the pdf.js worker). */
  file: Blob | null;
  /** Object URL of the downloaded file (open/download in a new tab). */
  blobUrl: string | null;
}

const INITIAL_STATE: PdfDocumentState = {
  status: 'loading',
  loadingMessage: 'Caricamento del documento...',
  error: null,
  file: null,
  blobUrl: null,
};

/**
 * Downloads GET /api/documents/{id}/file. Parsing and rendering are done by react-pdf.
 * The download is aborted and the object URL revoked when the document changes or on unmount.
 */
export function usePdfDocument(documentId: string, filename: string) {
  const [state, setState] = useState<PdfDocumentState>(INITIAL_STATE);

  useEffect(() => {
    let isCancelled = false;
    let createdUrl: string | null = null;
    const controller = new AbortController();

    async function loadPdf() {
      setState({ ...INITIAL_STATE, loadingMessage: `Download di "${filename}"...` });

      try {
        const blob = await documentService.getDocumentFile(documentId, controller.signal);
        if (isCancelled) return;

        createdUrl = URL.createObjectURL(blob);
        const blobUrl = createdUrl;
        setState((prev) => ({ ...prev, status: 'success', file: blob, blobUrl }));
      } catch (err: unknown) {
        if (isCancelled || isAbortError(err)) return;
        logError('Failed to load PDF in fact-check viewer:', err);
        setState((prev) => ({ ...prev, status: 'error', error: toUserMessage(err, 'pdf') }));
      }
    }

    void loadPdf();

    return () => {
      isCancelled = true;
      controller.abort();
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [documentId, filename]);

  return { ...state, isLoading: state.status === 'loading' };
}
