import { describe, it, expect } from 'vitest';
import { chatStreamReducer, initialChatStreamState, type ChatStreamState } from '@/src/features/chat/lib/chatStreamReducer';
import type { ChatMessage, CitationReference } from '@/src/features/chat/types';

const user: ChatMessage = { id: 'u1', role: 'user', content: 'Q', status: 'completed' };
const asst: ChatMessage = { id: 'a1', role: 'assistant', content: '', status: 'streaming', citations: [] };
const cite = (id: string) => ({ document_id: id }) as unknown as CitationReference;

const streaming = (): ChatStreamState =>
  chatStreamReducer(initialChatStreamState, { type: 'start', userMessage: user, assistantMessage: asst });
const active = (s: ChatStreamState) => s.messages.find((m) => m.id === 'a1')!;

describe('chatStreamReducer', () => {
  it('start appends user + streaming assistant and removes replacedIds', () => {
    const old: ChatMessage[] = [
      { id: 'o1', role: 'user', content: 'Q', status: 'completed' },
      { id: 'o2', role: 'assistant', content: 'x', status: 'error' },
      { id: 'keep', role: 'user', content: 'k', status: 'completed' },
    ];
    const base = chatStreamReducer(initialChatStreamState, { type: 'reset', messages: old });
    const s = chatStreamReducer(base, { type: 'start', userMessage: user, assistantMessage: asst, replacedIds: ['o1', 'o2'] });
    expect(s.messages.map((m) => m.id)).toEqual(['keep', 'u1', 'a1']);
    expect(s.isStreaming).toBe(true);
    expect(s.activeAssistantId).toBe('a1');
    expect(active(s).status).toBe('streaming');
  });

  it('start is ignored while a stream is active (ADR 0003)', () => {
    const s = streaming();
    const next = chatStreamReducer(s, {
      type: 'start',
      userMessage: { ...user, id: 'u2' },
      assistantMessage: { ...asst, id: 'a2' },
    });
    expect(next).toBe(s);
  });

  it('delta appends only to the active message; empty text keeps the same state', () => {
    let s = streaming();
    s = chatStreamReducer(s, { type: 'delta', text: 'ab' });
    s = chatStreamReducer(s, { type: 'delta', text: 'cd' });
    expect(active(s).content).toBe('abcd');
    expect(s.messages.find((m) => m.id === 'u1')!.content).toBe('Q');
    expect(chatStreamReducer(s, { type: 'delta', text: '' })).toBe(s);
    expect(chatStreamReducer(initialChatStreamState, { type: 'delta', text: 'x' })).toBe(initialChatStreamState);
  });

  it('citations accumulate on the active message', () => {
    let s = streaming();
    s = chatStreamReducer(s, { type: 'citations', references: [cite('d1')] });
    s = chatStreamReducer(s, { type: 'citations', references: [cite('d2')] });
    expect(active(s).citations).toHaveLength(2);
    expect(chatStreamReducer(s, { type: 'citations', references: [] })).toBe(s);
  });

  it('citations get stable incremental occurrence_key <msgId>:<i> across chunks', () => {
    let s = streaming();
    s = chatStreamReducer(s, { type: 'citations', references: [cite('d1'), cite('d1')] });
    s = chatStreamReducer(s, { type: 'citations', references: [cite('d1')] });
    expect(active(s).citations!.map((c) => c.occurrence_key)).toEqual(['a1:0', 'a1:1', 'a1:2']);
  });

  it('error keeps partial text, sets status error and ends the stream', () => {
    let s = chatStreamReducer(streaming(), { type: 'delta', text: 'parz' });
    s = chatStreamReducer(s, { type: 'error', error: 'boom' });
    expect(active(s)).toMatchObject({ status: 'error', content: 'parz', error: 'boom' });
    expect(s.isStreaming).toBe(false);
    expect(s.activeAssistantId).toBeNull();
  });

  it('abort keeps partial text, sets status aborted and ends the stream', () => {
    let s = chatStreamReducer(streaming(), { type: 'delta', text: 'parz' });
    s = chatStreamReducer(s, { type: 'abort' });
    expect(active(s)).toMatchObject({ status: 'aborted', content: 'parz' });
    expect(s.isStreaming).toBe(false);
  });

  it('done completes the message', () => {
    const s = chatStreamReducer(chatStreamReducer(streaming(), { type: 'delta', text: 'ok' }), { type: 'done' });
    expect(active(s)).toMatchObject({ status: 'completed', content: 'ok' });
    expect(s.isStreaming).toBe(false);
  });

  it('done does not overwrite error or aborted', () => {
    const err = chatStreamReducer(streaming(), { type: 'error', error: 'e' });
    expect(active(chatStreamReducer(err, { type: 'done' })).status).toBe('error');
    const ab = chatStreamReducer(streaming(), { type: 'abort' });
    expect(active(chatStreamReducer(ab, { type: 'done' })).status).toBe('aborted');
  });

  it('done / abort / error without a stream are no-ops', () => {
    for (const action of [{ type: 'done' }, { type: 'abort' }, { type: 'error', error: 'x' }] as const) {
      expect(chatStreamReducer(initialChatStreamState, action)).toBe(initialChatStreamState);
    }
  });

  it('late delta after the stream ended is not applied', () => {
    const s = chatStreamReducer(chatStreamReducer(streaming(), { type: 'delta', text: 'a' }), { type: 'abort' });
    expect(chatStreamReducer(s, { type: 'delta', text: 'late' })).toBe(s);
  });

  it('reset replaces messages and ends any stream', () => {
    const next: ChatMessage[] = [{ id: 'n', role: 'user', content: 'n', status: 'completed' }];
    const s = chatStreamReducer(streaming(), { type: 'reset', messages: next });
    expect(s).toEqual({ messages: next, activeAssistantId: null, isStreaming: false });
  });
});
