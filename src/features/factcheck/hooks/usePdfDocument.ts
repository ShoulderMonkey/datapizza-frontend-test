'use client';

import { useEffect, useState } from 'react';
import { logError, toUserMessage } from '@/src/api';
import type { AsyncStatus } from '../types';
import { useDocumentFile } from './useDocumentFile';

/**
 * Provides the PDF Blob of a document from the shared query cache (a document already
 * downloaded for a thumbnail is not downloaded again). Parsing and rendering are done by react-pdf.
 * The object URL is created here and revoked when the document changes or on unmount.
 */
export function usePdfDocument(documentId: string, filename: string) {
  const query = useDocumentFile(documentId);
  const file = query.data ?? null;
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setBlobUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setBlobUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (query.error) logError('Failed to load PDF in fact-check viewer:', query.error);
  }, [query.error]);

  const status: AsyncStatus = query.isError ? 'error' : file ? 'success' : 'loading';

  return {
    status,
    loadingMessage: `Download di "${filename}"...`,
    error: query.isError ? toUserMessage(query.error, 'pdf') : null,
    file,
    blobUrl: file ? blobUrl : null,
    isLoading: status === 'loading',
  };
}
