'use client';

import { useQuery } from '@tanstack/react-query';
import { documentService } from '@/src/api';
import { queryKeys } from '../../queryKeys';

/** Blobs are kept 30 minutes after the last observer unmounts (then garbage-collected). */
const FILE_GC_TIME_MS = 30 * 60 * 1000;

/**
 * Downloads GET /api/documents/{id}/file once per document_id and shares the Blob between
 * citation thumbnails and the PDF viewer (staleTime: Infinity, so it is never refetched).
 * Object URLs are NOT created here: the component using the Blob owns them.
 * `enabled: false` performs no request (used by lazy thumbnails before they are visible).
 */
export function useDocumentFile(documentId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.documents.file(documentId),
    queryFn: ({ signal }) => documentService.getDocumentFile(documentId, signal),
    enabled,
    staleTime: Infinity,
    gcTime: FILE_GC_TIME_MS,
  });
}
