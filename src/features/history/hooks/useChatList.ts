'use client';

import { useCallback, useEffect } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { chatService, logError, nextOffset, parseApiDate, toUserMessage } from '@/src/api';
import { queryKeys } from '../../queryKeys';
import type { ChatRecord } from '../types';


/** Newest first. Pure: returns a copy, the cached array is never mutated. */
export function sortChatsByCreatedAtDesc(chats: ChatRecord[]): ChatRecord[] {
  return [...chats].sort((a, b) => parseApiDate(b.created_at).getTime() - parseApiDate(a.created_at).getTime());
}

/**
 * Chat history (GET /api/chat/), loaded 20 at a time. The backend lists in insertion order without a
 * total, so "Carica altre" asks for the next offset; the loaded entries are shown newest first.
 */
export function useChatList() {
  const query = useInfiniteQuery({
    queryKey: queryKeys.chats.list(),
    queryFn: ({ pageParam, signal }) => chatService.listChats(pageParam, signal),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => nextOffset(lastPage, allPages.length),
    select: (data) => sortChatsByCreatedAtDesc(data.pages.flat()),
  });

  const { refetch, fetchNextPage } = query;

  // Technical detail to the console only; the UI gets the mapped message.
  const failure = query.isError ? query.error : null;
  useEffect(() => {
    if (failure) logError('Failed to load the chat history:', failure);
  }, [failure]);
  /**
   * Refetches every loaded page and resolves with the refreshed, sorted list (the previous data if
   * the request fails), so a caller can compare it with an earlier snapshot (ADR 0007).
   */
  const refresh = useCallback(async (): Promise<ChatRecord[]> => {
    const result = await refetch();
    return result.data ?? [];
  }, [refetch]);
  const loadMore = useCallback(async () => {
    await fetchNextPage();
  }, [fetchNextPage]);

  return {
    chats: query.data ?? [],
    isLoading: query.isFetching && query.data === undefined,
    isRefreshing: query.isFetching,
    error: query.isError && query.data === undefined ? toUserMessage(query.error, 'chat_list') : null,
    loadMoreError: query.isError && query.data !== undefined ? toUserMessage(query.error, 'chat_list') : null,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    loadMore,
    refresh,
  };
}
