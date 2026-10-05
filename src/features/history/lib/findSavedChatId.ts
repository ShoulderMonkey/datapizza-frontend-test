import type { ChatRecord } from '../types';

/**
 * Id of the history entry stored by the stream that just ended (ADR 0007).
 *
 * The stream does not return the chat id, so the entry is identified by difference: it is in the
 * refreshed list, it was not in the snapshot taken when the question was sent (`knownIds`), and its
 * `query` equals the question sent. If more than one entry matches (e.g. the same question asked in
 * another tab meanwhile), the most recent by `created_at` wins. Returns null when no loaded entry
 * matches (e.g. the new entry is beyond the loaded pages, ADR 0005).
 */
export function findSavedChatId(
  chats: readonly ChatRecord[],
  knownIds: ReadonlySet<string>,
  query: string
): string | null {
  let best: ChatRecord | null = null;
  let bestTime = Number.NEGATIVE_INFINITY;
  for (const chat of chats) {
    if (knownIds.has(chat.id) || chat.query !== query) continue;
    const time = Date.parse(chat.created_at);
    const comparable = Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
    if (best === null || comparable > bestTime) {
      best = chat;
      bestTime = comparable;
    }
  }
  return best?.id ?? null;
}
