'use client';

import { useCallback, useState } from 'react';
import { useChatDetail } from './useChatDetail';
import { useChatList } from './useChatList';

/** Chat list + active conversation selection, both backed by TanStack Query. */
export function useChatHistory() {
  const list = useChatList();
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const detail = useChatDetail(activeChatId);

  const clearActiveChat = useCallback(() => setActiveChatId(null), []);

  const activeChatTitle = activeChatId
    ? list.chats.find((c) => c.id === activeChatId)?.query || 'Conversazione'
    : 'Nuova sessione';

  return {
    chats: list.chats,
    isListLoading: list.isLoading,
    isListRefreshing: list.isRefreshing,
    listError: list.error,
    refresh: list.refresh,
    hasMoreChats: list.hasNextPage,
    isLoadingMoreChats: list.isFetchingNextPage,
    loadMoreChatsError: list.loadMoreError,
    loadMoreChats: list.loadMore,
    activeChatId,
    activeChatTitle,
    transcript: detail.transcript,
    isChatLoading: detail.isLoading,
    chatLoadError: detail.error,
    reloadChat: detail.reload,
    selectChat: setActiveChatId,
    clearActiveChat,
  };
}
