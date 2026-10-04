'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { chatService, toApiError } from '@/src/api';
import type { ChatHistoryEntry, ChatMessage, CitationReference } from '../types';

/** Shown for a `{"type":"error"}` chunk; the backend message only goes to the console. */
export const STREAM_ERROR_MESSAGE =
  'La generazione della risposta si è interrotta. Il testo parziale è stato conservato: puoi riprovare.';

const STREAM_FALLBACK_MESSAGE = 'La risposta si è interrotta. Puoi riprovare.';

interface UseChatStreamOptions {
  /** Called when a stream ends without throwing (also after an `error` chunk). */
  onStreamEnd?: () => void;
}

/**
 * Conversation messages and the NDJSON stream of POST /api/chat/.
 *
 * - One stream at a time: `send` is ignored while a stream is active (the composer is disabled).
 * - `cancel()` aborts the active stream (stop button, chat switch); unmount aborts too.
 * - Errors: `aborted` → message status `aborted`; any other ApiError → status `error` with
 *   `ApiError.userMessage`; `{"type":"error"}` chunk → status `error` with STREAM_ERROR_MESSAGE.
 *   The partial text is always kept.
 *
 * P1-03 will move this state to `useReducer` with typed actions and rAF batching.
 */
export function useChatStream({ onStreamEnd }: UseChatStreamOptions = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<ChatMessage[]>(messages);
  const optionsRef = useRef({ onStreamEnd });

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    optionsRef.current = { onStreamEnd };
  }, [onStreamEnd]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
  }, []);

  // Abort the active stream on unmount.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  const send = useCallback(async (queryText: string, options: { replaceMessageId?: string } = {}) => {
    if (abortRef.current) return;

    const now = Date.now();
    const assistantMessageId = `msg-asst-${now + 1}`;
    const userMessage: ChatMessage = {
      id: `msg-user-${now}`,
      role: 'user',
      content: queryText,
      status: 'completed',
      created_at: new Date().toISOString(),
    };
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      status: 'streaming',
      created_at: new Date().toISOString(),
      citations: [],
    };

    // On retry, drop the failed answer and its original question (re-added below), so the
    // conversation keeps a single user bubble and the history never repeats the question.
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

    setMessages((prev) => [
      ...prev.filter((m) => !replacedIds.has(m.id)),
      userMessage,
      assistantMessage,
    ]);
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    let content = '';
    const citations: CitationReference[] = [];
    const patchAssistant = (patch: Partial<ChatMessage>) =>
      setMessages((prev) => prev.map((m) => (m.id === assistantMessageId ? { ...m, ...patch } : m)));

    try {
      const stream = chatService.streamQuery(
        {
          query: queryText,
          history: history.length > 0 ? history : undefined,
        },
        controller.signal
      );

      let streamFailed = false;
      for await (const chunk of stream) {
        if (chunk.type === 'content') {
          content += chunk.delta;
          patchAssistant({ content });
        } else if (chunk.type === 'citations') {
          if (Array.isArray(chunk.references)) {
            citations.push(...chunk.references);
            patchAssistant({ citations: [...citations] });
          }
        } else if (chunk.type === 'error') {
          // Backend detail only in the console; the user sees a friendly message.
          console.error('Chat stream error chunk:', chunk.message);
          streamFailed = true;
          patchAssistant({ status: 'error', error: STREAM_ERROR_MESSAGE, content, citations });
          break;
        }
      }

      // Finalize as completed unless an error chunk already set status 'error'.
      if (!streamFailed) patchAssistant({ status: 'completed', content, citations });

      // Refresh the history to show the newly stored chat.
      optionsRef.current.onStreamEnd?.();
    } catch (err: unknown) {
      const apiError = toApiError(err);
      if (apiError.code === 'aborted') {
        patchAssistant({ status: 'aborted', content, citations });
      } else {
        console.error('Chat streaming failed:', err);
        const errorText = apiError.code === 'unknown' ? STREAM_FALLBACK_MESSAGE : apiError.userMessage;
        patchAssistant({ status: 'error', error: errorText, content, citations });
      }
    } finally {
      // A newer stream may have started after a cancel(): leave its state alone.
      if (abortRef.current === controller) {
        abortRef.current = null;
        setIsStreaming(false);
      }
    }
  }, []);

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

  /** Replaces the conversation (history selection, new chat). Does not cancel the stream. */
  const replaceMessages = useCallback((next: ChatMessage[]) => setMessages(next), []);

  return { messages, isStreaming, send, cancel, retry, replaceMessages };
}
