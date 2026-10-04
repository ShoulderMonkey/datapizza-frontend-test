'use client';

import { useCallback, useEffect, useState } from 'react';
import { chatService, getUserMessage } from '@/src/api';
import type { AsyncStatus, ChatRecord, ChatTranscript } from '../types';

const CHAT_LOAD_FALLBACK_MESSAGE = 'Impossibile caricare i messaggi della conversazione.';

/**
 * Chat history (GET /api/chat/) and the active conversation (GET /api/chat/{id}).
 * List errors are only logged (the sidebar keeps the last list); conversation errors
 * are exposed in `chatLoadError`.
 */
export function useChatHistory() {
  const [chats, setChats] = useState<ChatRecord[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chatStatus, setChatStatus] = useState<AsyncStatus>('idle');
  const [chatLoadError, setChatLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setChats(await chatService.listChats());
    } catch (err: unknown) {
      console.warn('Could not load chat history:', err);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    chatService
      .listChats()
      .then((list) => {
        if (isMounted) setChats(list);
      })
      .catch((err: unknown) => {
        console.warn('Could not load chat history:', err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  /** Loads a stored conversation; resolves to null on error (see `chatLoadError`). */
  const openChat = useCallback(async (chatId: string): Promise<ChatTranscript | null> => {
    setActiveChatId(chatId);
    setChatStatus('loading');
    setChatLoadError(null);
    try {
      const transcript = await chatService.getChat(chatId);
      setChatStatus('success');
      return transcript;
    } catch (err: unknown) {
      console.error('Failed to load chat details:', err);
      setChatLoadError(getUserMessage(err, CHAT_LOAD_FALLBACK_MESSAGE));
      setChatStatus('error');
      return null;
    }
  }, []);

  /** Leaves the active conversation (new chat). */
  const clearActiveChat = useCallback(() => {
    setActiveChatId(null);
    setChatStatus('idle');
    setChatLoadError(null);
  }, []);

  const activeChatTitle = activeChatId
    ? chats.find((c) => c.id === activeChatId)?.query || 'Conversazione'
    : 'Nuova sessione';

  return {
    chats,
    activeChatId,
    activeChatTitle,
    isChatLoading: chatStatus === 'loading',
    chatLoadError,
    refresh,
    openChat,
    clearActiveChat,
  };
}
