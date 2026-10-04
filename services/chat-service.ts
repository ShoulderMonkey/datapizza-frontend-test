import { rawRequest, request } from './api-client';
import { parseNDJSONStream } from '@/utils/ndjson';
import {
  ChatDetail,
  ChatMessage,
  ChatRequest,
  ChatSummary,
  StreamChunk,
} from '@/types/chat';

export const chatService = {
  /**
   * Fetches previous chat sessions.
   */
  async listChats(): Promise<ChatSummary[]> {
    const data = await request<unknown>('/api/chat/', {
      method: 'GET',
    });

    if (Array.isArray(data)) {
      return data.map(normalizeChatSummary);
    }
    if (data && typeof data === 'object') {
      const obj = data as Record<string, unknown>;
      if (Array.isArray(obj.chats)) {
        return obj.chats.map(normalizeChatSummary);
      }
      if (Array.isArray(obj.items)) {
        return obj.items.map(normalizeChatSummary);
      }
      if (Array.isArray(obj.sessions)) {
        return obj.sessions.map(normalizeChatSummary);
      }
    }
    return [];
  },

  /**
   * Fetches details of a specific chat session by ID.
   */
  async getChat(chatId: string): Promise<{ id: string; title: string; messages: ChatMessage[] }> {
    const encodedId = encodeURIComponent(chatId);
    const data = await request<ChatDetail>(`/api/chat/${encodedId}`, {
      method: 'GET',
    });

    return normalizeChatDetail(data, chatId);
  },

  /**
   * Sends a query to POST /api/chat/ and yields streaming chunks.
   */
  async *streamQuery(
    payload: ChatRequest,
    signal?: AbortSignal
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const body: Record<string, unknown> = {
      query: payload.query,
    };

    if (payload.history && payload.history.length > 0) {
      body.history = payload.history;
    }
    if (payload.chat_id) {
      body.chat_id = payload.chat_id;
    }

    const response = await rawRequest('/api/chat/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/x-ndjson, application/json, text/event-stream',
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.body) {
      throw new Error('Il server non ha restituito un flusso di risposta.');
    }

    yield* parseNDJSONStream(response.body, signal);
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

function normalizeChatDetail(data: unknown, fallbackId: string): { id: string; title: string; messages: ChatMessage[] } {
  if (!data || typeof data !== 'object') {
    return { id: fallbackId, title: 'Conversazione', messages: [] };
  }

  const obj = data as Record<string, unknown>;
  const id = String(obj.id ?? obj.chat_id ?? fallbackId);
  const title = String(obj.title ?? obj.query ?? `Chat ${id.slice(0, 8)}`);

  const rawMessages = Array.isArray(obj.messages)
    ? obj.messages
    : Array.isArray(obj.history)
    ? obj.history
    : [];

  const messages: ChatMessage[] = [];

  for (let i = 0; i < rawMessages.length; i++) {
    const raw = rawMessages[i];
    if (!raw || typeof raw !== 'object') continue;
    const msgObj = raw as Record<string, unknown>;

    // Handle formats where each item is { role: 'user' | 'assistant', content: string }
    // Or { query: '...', response: '...' }
    if (typeof msgObj.query === 'string' && typeof msgObj.response === 'string') {
      messages.push({
        id: `${id}-msg-${i * 2}`,
        role: 'user',
        content: msgObj.query,
        status: 'completed',
        created_at: msgObj.created_at ? String(msgObj.created_at) : undefined,
      });
      messages.push({
        id: `${id}-msg-${i * 2 + 1}`,
        role: 'assistant',
        content: msgObj.response,
        status: 'completed',
        citations: Array.isArray(msgObj.citations)
          ? msgObj.citations
          : Array.isArray(msgObj.references)
          ? msgObj.references
          : undefined,
        created_at: msgObj.created_at ? String(msgObj.created_at) : undefined,
      });
      continue;
    }

    const role = (msgObj.role as string) === 'user' ? 'user' : 'assistant';
    const content = String(msgObj.content ?? msgObj.text ?? msgObj.message ?? '');
    const citations = Array.isArray(msgObj.citations)
      ? msgObj.citations
      : Array.isArray(msgObj.references)
      ? msgObj.references
      : undefined;

    messages.push({
      id: String(msgObj.id ?? `${id}-msg-${i}`),
      role,
      content,
      status: 'completed',
      citations,
      created_at: msgObj.created_at ? String(msgObj.created_at) : undefined,
    });
  }

  return { id, title, messages };
}
