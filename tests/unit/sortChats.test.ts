import { describe, it, expect } from 'vitest';
import { sortChatsByCreatedAtDesc } from '@/src/features/history/hooks/useChatList';
import type { ChatRecord } from '@/src/api';

const chat = (id: string, created_at: string): ChatRecord => ({
  id, user_id: 'u1', created_at, query: `q-${id}`, response: 'r',
});

describe('sortChatsByCreatedAtDesc', () => {
  it('orders newest first without mutating the input', () => {
    const input = [chat('a', '2025-01-01T10:00:00Z'), chat('c', '2025-03-01T10:00:00Z'), chat('b', '2025-02-01T10:00:00Z')];
    const snapshot = input.map((c) => c.id);
    expect(sortChatsByCreatedAtDesc(input).map((c) => c.id)).toEqual(['c', 'b', 'a']);
    expect(input.map((c) => c.id)).toEqual(snapshot);
  });

  it('compares dates, not strings (different offsets)', () => {
    const early = chat('early', '2025-01-01T12:00:00+05:00'); // 07:00Z
    const late = chat('late', '2025-01-01T09:00:00+00:00'); // 09:00Z
    expect(sortChatsByCreatedAtDesc([early, late]).map((c) => c.id)).toEqual(['late', 'early']);
  });
});
