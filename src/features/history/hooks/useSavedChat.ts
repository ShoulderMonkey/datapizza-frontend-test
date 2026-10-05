'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { findSavedChatId } from '../lib/findSavedChatId';
import type { ChatRecord } from '../types';

/** Text of the `role="status"` announcement after a successful stream (ADR 0007). */
export const SAVED_CHAT_ANNOUNCEMENT = 'Conversazione salvata nello storico';

/**
 * - `idle`: nothing to announce (no question sent, or reset by new chat / selection / logout).
 * - `pending`: a question was sent; the live region is mounted (empty) so the later text is announced.
 * - `saved`: the stream ended without errors and the list was refreshed. `chatId` is the new entry,
 *   or null when it is not among the loaded pages (the announcement is shown anyway).
 */
export type SavedChatState =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'saved'; chatId: string | null };

/** Outcome of a stream, as reported by the chat stream at its end. */
export interface SavedChatStreamResult {
  /** True when the stream ended without an `error` chunk: the backend stored a new chat. */
  saved: boolean;
  /** The question sent, as stored by the backend in `query`. */
  query: string;
}

interface UseSavedChatOptions {
  chats: readonly ChatRecord[];
  /** Refetches the list and resolves with the refreshed entries. */
  refresh: () => Promise<readonly ChatRecord[]>;
}

const IDLE: SavedChatState = { status: 'idle' };

/**
 * Feedback for the history entry stored at the end of a stream (P1-14, ADR 0007).
 *
 * Distinct from the selection (`useChatHistory.activeChatId`): marking the saved entry never loads
 * its transcript, so the local multi-turn conversation stays on screen (ADR 0004).
 * - `begin()` (on every send/retry) snapshots the ids of the loaded entries.
 * - `complete()` (at the end of the stream) refreshes the list and, if the stream succeeded,
 *   identifies the new entry by difference with the snapshot (`findSavedChatId`).
 * - `clear()` (new chat, selection of an entry, logout) drops the state; a refresh still in flight
 *   for a superseded send is ignored.
 */
export function useSavedChat({ chats, refresh }: UseSavedChatOptions) {
  const [state, setState] = useState<SavedChatState>(IDLE);
  const chatsRef = useRef(chats);
  /** Snapshot of the send being tracked; replaced by `begin`, dropped by `clear`. */
  const pendingRef = useRef<{ knownIds: ReadonlySet<string> } | null>(null);

  useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);

  const begin = useCallback(() => {
    pendingRef.current = { knownIds: new Set(chatsRef.current.map((c) => c.id)) };
    setState({ status: 'pending' });
  }, []);

  const clear = useCallback(() => {
    pendingRef.current = null;
    setState(IDLE);
  }, []);

  const complete = useCallback(
    async ({ saved, query }: SavedChatStreamResult) => {
      const pending = pendingRef.current;
      // The list is refreshed after every stream end (also after an error chunk), as before.
      const refreshed = await refresh();
      // A newer send, a new chat or a selection happened meanwhile: this result is stale.
      if (pending === null || pendingRef.current !== pending) return;
      pendingRef.current = null;
      setState(saved ? { status: 'saved', chatId: findSavedChatId(refreshed, pending.knownIds, query) } : IDLE);
    },
    [refresh]
  );

  return {
    state,
    savedChatId: state.status === 'saved' ? state.chatId : null,
    begin,
    clear,
    complete,
  };
}
