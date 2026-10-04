'use client';

import { useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { chatService, logError, toUserMessage } from '@/src/api';
import { queryKeys } from '../../queryKeys';
import type { ChatRecord } from '../types';


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

  // Technical detail to the console only; the UI gets the mapped message.
  const failure = query.isError ? query.error : null;
  useEffect(() => {
    if (failure) logError('Failed to load the chat history:', failure);
  }, [failure]);
  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return {
    chats: query.data ?? [],
    isLoading: query.isFetching && query.data === undefined,
    isRefreshing: query.isFetching,
    error: query.isError ? toUserMessage(query.error, 'chat_list') : null,
    refresh,
  };
}
