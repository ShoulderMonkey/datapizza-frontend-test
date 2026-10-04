'use client';

import { useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { documentService, logError, toUserMessage } from '@/src/api';
import { queryKeys } from '../../queryKeys';


/**
 * Document list (GET /api/documents/) as server state. All consumers share the same query
 * key, so an invalidation after an upload updates every one of them (sidebar badge included).
 */
export function useDocuments({ enabled = true }: { enabled?: boolean } = {}) {
  const query = useQuery({
    queryKey: queryKeys.documents.list(),
    queryFn: () => documentService.listDocuments(),
    enabled,
  });

  const { refetch } = query;

  // Technical detail to the console only; the UI gets the mapped message.
  const failure = query.isError ? query.error : null;
  useEffect(() => {
    if (failure) logError('Failed to load the document list:', failure);
  }, [failure]);
  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return {
    documents: query.data ?? [],
    isLoading: query.isFetching && query.data === undefined,
    hasLoaded: query.data !== undefined,
    error: query.isError ? toUserMessage(query.error, 'documents') : null,
    refresh,
  };
}
