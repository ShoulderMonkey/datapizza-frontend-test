'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { documentService, getUserMessage } from '@/src/api';
import type { AsyncStatus, Document } from '../types';

const LIST_FALLBACK_MESSAGE = 'Non è stato possibile caricare la lista documenti.';

/**
 * Document list (GET /api/documents/). Loads when `enabled` becomes true and on `refresh()`.
 * Responses that arrive after unmount or after a newer request are ignored.
 */
export function useDocuments({ enabled = true }: { enabled?: boolean } = {}) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [status, setStatus] = useState<AsyncStatus>(enabled ? 'loading' : 'idle');
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setStatus('loading');
    setError(null);
    try {
      const docs = await documentService.listDocuments();
      if (requestId !== requestIdRef.current) return;
      setDocuments(docs);
      setHasLoaded(true);
      setStatus('success');
    } catch (err: unknown) {
      if (requestId !== requestIdRef.current) return;
      console.error('Failed to list documents:', err);
      setError(getUserMessage(err, LIST_FALLBACK_MESSAGE));
      setStatus('error');
    }
  }, []);

  /** Makes in-flight responses stale (disable/unmount). */
  const invalidate = useCallback(() => {
    requestIdRef.current++;
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    return invalidate;
  }, [enabled, refresh, invalidate]);

  /** `hasLoaded`: at least one successful load (the list is meaningful even while refreshing). */
  return { documents, status, isLoading: status === 'loading', hasLoaded, error, refresh };
}
