'use client';

import { useCallback, useEffect, useReducer, useRef } from 'react';
import { chatService, toApiError } from '@/src/api';
import { chatStreamReducer, initialChatStreamState, type ChatStreamAction } from '../lib/chatStreamReducer';
import type { ChatHistoryEntry, ChatMessage, CitationReference } from '../types';

/** Shown for a `{"type":"error"}` chunk; the backend message only goes to the console. */
export const STREAM_ERROR_MESSAGE =
  'La generazione della risposta si è interrotta. Il testo parziale è stato conservato: puoi riprovare.';

const STREAM_FALLBACK_MESSAGE = 'La risposta si è interrotta. Puoi riprovare.';

interface UseChatStreamOptions {
  /** Called when a stream ends without throwing (also after an `error` chunk). Not after an abort. */
  onStreamEnd?: () => void;
}

type FrameHandle = { kind: 'raf'; id: number } | { kind: 'timeout'; id: ReturnType<typeof setTimeout> };

/** `requestAnimationFrame` with a ~60 fps timeout fallback (environments without rAF). */
function requestFrame(callback: () => void): FrameHandle {
  if (typeof requestAnimationFrame === 'function') {
    return { kind: 'raf', id: requestAnimationFrame(() => callback()) };
  }
  return { kind: 'timeout', id: setTimeout(callback, 16) };
}

function cancelFrame(handle: FrameHandle): void {
  if (handle.kind === 'raf') cancelAnimationFrame(handle.id);
  else clearTimeout(handle.id);
}

/**
 * Conversation messages and the NDJSON stream of POST /api/chat/ (P1-03).
 *
 * - State lives in the pure `chatStreamReducer` (typed actions: start, delta, citations,
 *   error, abort, done, reset).
 * - `content` deltas are accumulated in a buffer and dispatched at most once per animation
 *   frame; the buffer is flushed synchronously before every final action (`done`, `error`,
 *   `abort`), so the final text equals the concatenation of the deltas.
 * - One stream at a time (ADR 0003): `send` is ignored while a stream is active; the UI
 *   disables the composer and shows the Stop button instead.
 * - Abort: `cancel()` (Stop), `replaceMessages()` (chat switch / new chat) and unmount.
 *   After an abort the stream loop never dispatches again: every dispatch is guarded by a
 *   generation token and the AbortSignal. The partial message keeps status `aborted`.
 * - Errors: `{"type":"error"}` chunk → status `error` with STREAM_ERROR_MESSAGE; any other
 *   ApiError → status `error` with `ApiError.userMessage`. The partial text is always kept.
 */
export function useChatStream({ onStreamEnd }: UseChatStreamOptions = {}) {
  const [state, dispatch] = useReducer(chatStreamReducer, initialChatStreamState);
  const { messages, isStreaming } = state;

  const controllerRef = useRef<AbortController | null>(null);
  /** Incremented on every start/abort/unmount: a stream may dispatch only with its own generation. */
  const generationRef = useRef(0);
  const pendingDeltaRef = useRef('');
  const frameRef = useRef<FrameHandle | null>(null);
  const messagesRef = useRef<ChatMessage[]>(messages);
  const optionsRef = useRef({ onStreamEnd });

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    optionsRef.current = { onStreamEnd };
  }, [onStreamEnd]);

  const cancelScheduledFlush = useCallback(() => {
    if (frameRef.current !== null) {
      cancelFrame(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  /** Dispatches the buffered text now (one `delta` action for everything accumulated). */
  const flushPendingDelta = useCallback(() => {
    cancelScheduledFlush();
    const text = pendingDeltaRef.current;
    pendingDeltaRef.current = '';
    if (text) dispatch({ type: 'delta', text });
  }, [cancelScheduledFlush]);

  /** Schedules a single flush for the next frame; further deltas join the same buffer. */
  const scheduleDeltaFlush = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = requestFrame(() => {
      frameRef.current = null;
      flushPendingDelta();
    });
  }, [flushPendingDelta]);

  /** Drops the buffer and the pending frame and invalidates the running stream. */
  const detachStream = useCallback(() => {
    generationRef.current += 1;
    cancelScheduledFlush();
    pendingDeltaRef.current = '';
    const controller = controllerRef.current;
    controllerRef.current = null;
    controller?.abort();
  }, [cancelScheduledFlush]);

  /** Stops the active stream: the partial text stays, with status `aborted`. */
  const cancel = useCallback(() => {
    if (!controllerRef.current) return;
    flushPendingDelta();
    dispatch({ type: 'abort' });
    detachStream();
  }, [flushPendingDelta, detachStream]);

  // Unmount: abort the request and drop pending work, without dispatching.
  useEffect(() => detachStream, [detachStream]);

  const send = useCallback(
    async (queryText: string, options: { replaceMessageId?: string } = {}) => {
      // ADR 0003: a new send during an active stream is disabled (not queued, not interrupting).
      if (controllerRef.current) return;

      const now = Date.now();
      const userMessage: ChatMessage = {
        id: `msg-user-${now}`,
        role: 'user',
        content: queryText,
        status: 'completed',
        created_at: new Date().toISOString(),
      };
      const assistantMessage: ChatMessage = {
        id: `msg-asst-${now + 1}`,
        role: 'assistant',
        content: '',
        status: 'streaming',
        created_at: new Date().toISOString(),
        citations: [],
      };

      // On retry, drop the failed answer and its original question (re-added as userMessage),
      // so the conversation keeps a single user bubble and the history never repeats the question.
      const replacedIds = new Set<string>();
      if (options.replaceMessageId) {
        replacedIds.add(options.replaceMessageId);
        const list = messagesRef.current;
        const idx = list.findIndex((m) => m.id === options.replaceMessageId);
        if (idx > 0 && list[idx - 1].role === 'user' && list[idx - 1].content === queryText) {
          replacedIds.add(list[idx - 1].id);
        }
      }

      const history: ChatHistoryEntry[] = messagesRef.current
        .filter((m) => !replacedIds.has(m.id) && m.status === 'completed' && m.content)
        .map((m) => ({ role: m.role, content: m.content }));

      const controller = new AbortController();
      controllerRef.current = controller;
      generationRef.current += 1;
      const generation = generationRef.current;
      pendingDeltaRef.current = '';

      const isCurrent = () => generationRef.current === generation && !controller.signal.aborted;
      /** Every dispatch of this stream goes through here: nothing is dispatched after an abort. */
      const emit = (action: ChatStreamAction) => {
        if (isCurrent()) dispatch(action);
      };
      const flushAndEmit = (action: ChatStreamAction) => {
        if (!isCurrent()) return;
        flushPendingDelta();
        dispatch(action);
      };

      dispatch({ type: 'start', userMessage, assistantMessage, replacedIds: [...replacedIds] });

      try {
        const stream = chatService.streamQuery(
          { query: queryText, history: history.length > 0 ? history : undefined },
          controller.signal
        );

        let streamFailed = false;
        for await (const chunk of stream) {
          if (!isCurrent()) break;
          if (chunk.type === 'content') {
            pendingDeltaRef.current += chunk.delta;
            scheduleDeltaFlush();
          } else if (chunk.type === 'citations') {
            if (Array.isArray(chunk.references)) {
              const references: CitationReference[] = chunk.references;
              emit({ type: 'citations', references });
            }
          } else if (chunk.type === 'error') {
            // Backend detail only in the console; the user sees a friendly message.
            console.error('Chat stream error chunk:', chunk.message);
            streamFailed = true;
            flushAndEmit({ type: 'error', error: STREAM_ERROR_MESSAGE });
            break;
          }
        }

        if (!isCurrent()) return;
        // `done` never overwrites the `error` set by an error chunk (reducer rule, P0-05).
        if (!streamFailed) flushAndEmit({ type: 'done' });
        // Refresh the history to show the newly stored chat.
        optionsRef.current.onStreamEnd?.();
      } catch (err: unknown) {
        // Aborted by cancel()/chat switch/unmount: the abort was already handled, stay silent.
        if (!isCurrent()) return;
        const apiError = toApiError(err);
        if (apiError.code === 'aborted') {
          flushAndEmit({ type: 'abort' });
        } else {
          console.error('Chat streaming failed:', err);
          const errorText = apiError.code === 'unknown' ? STREAM_FALLBACK_MESSAGE : apiError.userMessage;
          flushAndEmit({ type: 'error', error: errorText });
        }
      } finally {
        // A newer stream may have started after a cancel(): leave its refs alone.
        if (controllerRef.current === controller) {
          controllerRef.current = null;
          cancelScheduledFlush();
          pendingDeltaRef.current = '';
        }
      }
    },
    [flushPendingDelta, scheduleDeltaFlush, cancelScheduledFlush]
  );

  /** Re-sends the user question preceding `message`, replacing the failed/aborted answer. */
  const retry = useCallback(
    (message: ChatMessage) => {
      const list = messagesRef.current;
      const index = list.findIndex((m) => m.id === message.id);
      if (index > 0 && list[index - 1].role === 'user') {
        void send(list[index - 1].content, { replaceMessageId: message.id });
      } else if (message.content) {
        void send(message.content);
      }
    },
    [send]
  );

  /**
   * Replaces the conversation (history selection, new chat). A running stream belongs to the
   * previous conversation, so it is aborted first.
   */
  const replaceMessages = useCallback(
    (next: ChatMessage[]) => {
      cancel();
      dispatch({ type: 'reset', messages: next });
    },
    [cancel]
  );

  /** Citations of the whole conversation, read at call time (stable callback for memoized rows). */
  const getConversationCitations = useCallback(
    (): CitationReference[] => messagesRef.current.flatMap((m) => m.citations ?? []),
    []
  );

  return { messages, isStreaming, send, cancel, retry, replaceMessages, getConversationCitations };
}
