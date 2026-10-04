'use client';

import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { documentService, getUserMessage } from '@/src/api';
import { queryKeys } from '../../queryKeys';

const LIST_FALLBACK_MESSAGE = 'Non è stato possibile caricare la lista documenti.';

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
  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return {
    documents: query.data ?? [],
    isLoading: query.isFetching && query.data === undefined,
    hasLoaded: query.data !== undefined,
    error: query.isError ? getUserMessage(query.error, LIST_FALLBACK_MESSAGE) : null,
    refresh,
  };
}
