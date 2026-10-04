import { request, requestStream } from './client';
import { fetchAllPages } from './pagination';
import { ApiError, createApiError, toApiError } from './errors';
import { parseNDJSONStream } from './ndjson';
import type {
  ChatRecord,
  ChatRequest,
  ChatTranscript,
  ChatTranscriptMessage,
  CitationReference,
  StreamChunk,
} from './types';

const CHAT_ENDPOINT = '/api/chat/';

export const chatService = {
  /** GET /api/chat/: every page (limit=100) of chat records, bare arrays (docs/AUDIT.md §2). */
  async listChats(signal?: AbortSignal): Promise<ChatRecord[]> {
    return fetchAllPages<ChatRecord>(CHAT_ENDPOINT, { signal, validate: asChatRecord });
  },

  /** GET /api/chat/{id}, converted into a transcript of user/assistant messages. */
  async getChat(chatId: string, signal?: AbortSignal): Promise<ChatTranscript> {
    const data = await request<unknown>(`${CHAT_ENDPOINT}${encodeURIComponent(chatId)}`, {
      method: 'GET',
      signal,
    });
    return toTranscript(asChatRecord(data));
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
    const body: ChatRequest = { query: payload.query };
    if (payload.history && payload.history.length > 0) {
      body.history = payload.history;
    }

    const stream = await requestStream(CHAT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/x-ndjson',
      },
      body: JSON.stringify(body),
      signal,
    });

    try {
      yield* parseNDJSONStream(stream, signal);
    } catch (err: unknown) {
      throw toApiError(err, { fallbackCode: 'network', endpoint: CHAT_ENDPOINT });
    }
  },
};

function invalidResponse(): ApiError {
  return createApiError('invalid_response', { endpoint: CHAT_ENDPOINT });
}

/** Narrows an unknown JSON value to ChatRecord; anything else is an `invalid_response` error. */
function asChatRecord(data: unknown): ChatRecord {
  if (!data || typeof data !== 'object') throw invalidResponse();
  const obj = data as Record<string, unknown>;
  if (
    typeof obj.id !== 'string' ||
    typeof obj.query !== 'string' ||
    typeof obj.response !== 'string' ||
    typeof obj.created_at !== 'string'
  ) {
    throw invalidResponse();
  }
  return {
    id: obj.id,
    user_id: typeof obj.user_id === 'string' ? obj.user_id : '',
    created_at: obj.created_at,
    query: obj.query,
    response: obj.response,
    citations: Array.isArray(obj.citations) ? (obj.citations as CitationReference[]) : undefined,
  };
}

/** One chat record (one Q/A pair) becomes two messages. */
function toTranscript(record: ChatRecord): ChatTranscript {
  const messages: ChatTranscriptMessage[] = [
    { id: `${record.id}-msg-0`, role: 'user', content: record.query, created_at: record.created_at },
    {
      id: `${record.id}-msg-1`,
      role: 'assistant',
      content: record.response,
      citations: record.citations,
      created_at: record.created_at,
    },
  ];
  return { id: record.id, title: record.query, messages };
}
