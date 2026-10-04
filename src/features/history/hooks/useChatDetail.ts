'use client';

import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { chatService, getUserMessage } from '@/src/api';
import { queryKeys } from '../../queryKeys';

const CHAT_LOAD_FALLBACK_MESSAGE = 'Impossibile caricare i messaggi della conversazione.';

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
  const reload = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return {
    transcript: chatId !== null ? query.data : undefined,
    isLoading: chatId !== null && query.isLoading,
    error: chatId !== null && query.isError ? getUserMessage(query.error, CHAT_LOAD_FALLBACK_MESSAGE) : null,
    reload,
  };
}
