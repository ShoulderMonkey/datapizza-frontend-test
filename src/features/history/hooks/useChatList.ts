'use client';

import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { chatService, getUserMessage } from '@/src/api';
import { queryKeys } from '../../queryKeys';
import type { ChatRecord } from '../types';

const LIST_FALLBACK_MESSAGE = 'Non è stato possibile caricare la cronologia.';

/** Newest first. Pure: returns a copy, the cached array is never mutated. */
export function sortChatsByCreatedAtDesc(chats: ChatRecord[]): ChatRecord[] {
  return [...chats].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
}

/** Chat history (GET /api/chat/), ordered by `created_at` descending. */
export function useChatList() {
  const query = useQuery({
    queryKey: queryKeys.chats.list(),
    queryFn: () => chatService.listChats(),
    select: sortChatsByCreatedAtDesc,
  });

  const { refetch } = query;
  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return {
    chats: query.data ?? [],
    isLoading: query.isFetching && query.data === undefined,
    isRefreshing: query.isFetching,
    error: query.isError ? getUserMessage(query.error, LIST_FALLBACK_MESSAGE) : null,
    refresh,
  };
}
