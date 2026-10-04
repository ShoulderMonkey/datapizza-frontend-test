import { request, requestStream } from './client';
import { toApiError } from './errors';
import { parseNDJSONStream } from './ndjson';
import type {
  ChatRequest,
  ChatSummary,
  ChatTranscript,
  ChatTranscriptMessage,
  CitationReference,
  StreamChunk,
} from './types';

const CHAT_ENDPOINT = '/api/chat/';

export const chatService = {
  /** GET /api/chat/ */
  async listChats(): Promise<ChatSummary[]> {
    const data = await request<unknown>(CHAT_ENDPOINT, { method: 'GET' });

    // Speculative shapes kept until P1-02 (the backend returns a bare array, docs/AUDIT.md §2).
    if (Array.isArray(data)) {
      return data.map(normalizeChatSummary);
    }
    if (data && typeof data === 'object') {
      const obj = data as Record<string, unknown>;
      if (Array.isArray(obj.chats)) return obj.chats.map(normalizeChatSummary);
      if (Array.isArray(obj.items)) return obj.items.map(normalizeChatSummary);
      if (Array.isArray(obj.sessions)) return obj.sessions.map(normalizeChatSummary);
    }
    return [];
  },

  /** GET /api/chat/{id}, normalized into a transcript of user/assistant messages. */
  async getChat(chatId: string): Promise<ChatTranscript> {
    const data = await request<unknown>(`${CHAT_ENDPOINT}${encodeURIComponent(chatId)}`, {
      method: 'GET',
      errorMessages: { not_found: 'La conversazione richiesta non esiste più.' },
    });
    return normalizeChatDetail(data, chatId);
  },

  /**
   * POST /api/chat/ and yields the NDJSON chunks.
   *
   * Every failure is an ApiError: HTTP errors before the stream (`bad_request`, `unauthorized`,
   * `server`, ...), `network` if the connection drops, `stream_parse` for a malformed line,
   * `aborted` when `signal` is aborted. `{"type":"error"}` chunks are yielded, not thrown:
   * they are an application error the caller renders.
   */
  async *streamQuery(payload: ChatRequest, signal?: AbortSignal): AsyncGenerator<StreamChunk, void, unknown> {
    const body: Record<string, unknown> = { query: payload.query };
    if (payload.history && payload.history.length > 0) {
      body.history = payload.history;
    }
    if (payload.chat_id) {
      body.chat_id = payload.chat_id;
    }

    const stream = await requestStream(CHAT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/x-ndjson, application/json, text/event-stream',
      },
      body: JSON.stringify(body),
      signal,
      errorMessages: {
        // BE:src/routes/chat.py:228-236
        bad_request: 'La domanda è vuota o supera i 10000 caratteri consentiti.',
      },
    });

    try {
      yield* parseNDJSONStream(stream, signal);
    } catch (err: unknown) {
      throw toApiError(err, { fallbackCode: 'network', endpoint: CHAT_ENDPOINT });
    }
  },
};

function normalizeChatSummary(item: unknown): ChatSummary {
  if (!item || typeof item !== 'object') {
    return { id: String(item ?? ''), title: 'Conversazione' };
  }
  const obj = item as Record<string, unknown>;
  const id = String(obj.id ?? obj.chat_id ?? obj.session_id ?? '');
  const title =
    (obj.title as string) ||
    (obj.query as string) ||
    (obj.preview as string) ||
    (obj.first_message as string) ||
    `Chat ${id.slice(0, 8)}`;
  const createdAt = obj.created_at ? String(obj.created_at) : undefined;
  const messageCount = typeof obj.message_count === 'number' ? obj.message_count : undefined;

  return {
    ...obj,
    id,
    title,
    created_at: createdAt,
    message_count: messageCount,
  };
}

function citationsOf(obj: Record<string, unknown>): CitationReference[] | undefined {
  if (Array.isArray(obj.citations)) return obj.citations as CitationReference[];
  if (Array.isArray(obj.references)) return obj.references as CitationReference[];
  return undefined;
}

function normalizeChatDetail(data: unknown, fallbackId: string): ChatTranscript {
  if (!data || typeof data !== 'object') {
    return { id: fallbackId, title: 'Conversazione', messages: [] };
  }

  const obj = data as Record<string, unknown>;
  const id = String(obj.id ?? obj.chat_id ?? fallbackId);
  const title = String(obj.title ?? obj.query ?? `Chat ${id.slice(0, 8)}`);

  const rawMessages: unknown[] = Array.isArray(obj.messages)
    ? obj.messages
    : Array.isArray(obj.history)
    ? obj.history
    : [];

  const messages: ChatTranscriptMessage[] = [];

  // Real backend shape: one chat = one Q/A pair at the root (docs/AUDIT.md §2).
  if (rawMessages.length === 0 && typeof obj.query === 'string' && typeof obj.response === 'string') {
    const createdAt = obj.created_at ? String(obj.created_at) : undefined;
    messages.push({ id: `${id}-msg-0`, role: 'user', content: obj.query, created_at: createdAt });
    messages.push({
      id: `${id}-msg-1`,
      role: 'assistant',
      content: obj.response,
      citations: citationsOf(obj),
      created_at: createdAt,
    });
  }

  for (let i = 0; i < rawMessages.length; i++) {
    const raw = rawMessages[i];
    if (!raw || typeof raw !== 'object') continue;
    const msgObj = raw as Record<string, unknown>;
    const createdAt = msgObj.created_at ? String(msgObj.created_at) : undefined;

    // { query, response } pairs (one backend chat record) become two messages.
    if (typeof msgObj.query === 'string' && typeof msgObj.response === 'string') {
      messages.push({ id: `${id}-msg-${i * 2}`, role: 'user', content: msgObj.query, created_at: createdAt });
      messages.push({
        id: `${id}-msg-${i * 2 + 1}`,
        role: 'assistant',
        content: msgObj.response,
        citations: citationsOf(msgObj),
        created_at: createdAt,
      });
      continue;
    }

    messages.push({
      id: String(msgObj.id ?? `${id}-msg-${i}`),
      role: msgObj.role === 'user' ? 'user' : 'assistant',
      content: String(msgObj.content ?? msgObj.text ?? msgObj.message ?? ''),
      citations: citationsOf(msgObj),
      created_at: createdAt,
    });
  }

  return { id, title, messages };
}
