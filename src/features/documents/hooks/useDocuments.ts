'use client';

import { useCallback, useEffect } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { documentService, logError, nextOffset, toUserMessage } from '@/src/api';
import { queryKeys } from '../../queryKeys';


/**
 * Document list (GET /api/documents/) as server state. All consumers share the same query
 * key, so an invalidation after an upload updates every one of them (sidebar badge included).
 */
export function useDocuments({ enabled = true }: { enabled?: boolean } = {}) {
  const query = useInfiniteQuery({
    queryKey: queryKeys.documents.list(),
    queryFn: ({ pageParam, signal }) => documentService.listDocuments(pageParam, signal),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => nextOffset(lastPage, allPages.length),
    select: (data) => data.pages.flat(),
    enabled,
  });

  const { refetch, fetchNextPage } = query;

  // Technical detail to the console only; the UI gets the mapped message.
  const failure = query.isError ? query.error : null;
  useEffect(() => {
    if (failure) logError('Failed to load the document list:', failure);
  }, [failure]);
  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const loadMore = useCallback(async () => {
    await fetchNextPage();
  }, [fetchNextPage]);

  return {
    documents: query.data ?? [],
    isLoading: query.isFetching && query.data === undefined,
    hasLoaded: query.data !== undefined,
    error: query.isError && query.data === undefined ? toUserMessage(query.error, 'documents') : null,
    loadMoreError: query.isError && query.data !== undefined ? toUserMessage(query.error, 'documents') : null,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    loadMore,
    refresh,
  };
}
