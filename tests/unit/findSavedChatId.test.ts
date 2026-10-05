import { describe, it, expect } from 'vitest';
import { findSavedChatId } from '@/src/features/history/lib/findSavedChatId';

const rec = (id: string, created_at: string, query: string) => ({ id, user_id: 'u', created_at, query, response: 'r' });

describe('findSavedChatId', () => {
  it('picks the new entry, not the old one with the same query (repeated question)', () => {
    const chats = [rec('old', '2025-01-01T10:00:00Z', 'Q'), rec('new', '2025-06-01T10:00:00Z', 'Q')];
    expect(findSavedChatId(chats, new Set(['old']), 'Q')).toBe('new');
  });
  it('ignores new entries with a different query', () => {
    expect(findSavedChatId([rec('x', '2025-06-01T10:00:00Z', 'Altro')], new Set(), 'Q')).toBeNull();
  });
  it('returns null when nothing is new', () => {
    expect(findSavedChatId([rec('a', '2025-01-01T10:00:00Z', 'Q')], new Set(['a']), 'Q')).toBeNull();
    expect(findSavedChatId([], new Set(), 'Q')).toBeNull();
  });
  it('with several candidates, the most recent created_at wins regardless of order', () => {
    const chats = [rec('n2', '2025-06-02T10:00:00Z', 'Q'), rec('n1', '2025-06-01T10:00:00Z', 'Q')];
    expect(findSavedChatId(chats, new Set(), 'Q')).toBe('n2');
    expect(findSavedChatId([...chats].reverse(), new Set(), 'Q')).toBe('n2');
  });
});
