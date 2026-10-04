'use client';

import { useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { chatService, logError, toUserMessage } from '@/src/api';
import { queryKeys } from '../../queryKeys';


/**
 * Stored conversation (GET /api/chat/{id}). The query key contains the id, so the data always
 * belongs to the chat selected last; a superseded request is cancelled through TanStack's signal.
 */
export function useChatDetail(chatId: string | null) {
  const query = useQuery({
    queryKey: queryKeys.chat.detail(chatId ?? ''),
    queryFn: ({ signal }) => chatService.getChat(chatId as string, signal),
    enabled: chatId !== null,
  });

  const { refetch } = query;

  // Technical detail to the console only; the UI gets the mapped message.
  const failure = query.isError ? query.error : null;
  useEffect(() => {
    if (failure) logError('Failed to load the conversation:', failure);
  }, [failure]);
  const reload = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return {
    transcript: chatId !== null ? query.data : undefined,
    isLoading: chatId !== null && query.isLoading,
    error: chatId !== null && query.isError ? toUserMessage(query.error, 'chat_detail') : null,
    reload,
  };
}
