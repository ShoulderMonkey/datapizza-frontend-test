import type { ChatMessage, CitationReference } from '../types';

/**
 * Pure state machine of the chat stream (P1-03). No React, no side effects: the hook
 * `useChatStream` owns the network, the rAF batching and the abort controller.
 *
 * Invariants:
 * - At most one active stream: `activeAssistantId !== null` iff `isStreaming`.
 * - `start` is ignored while a stream is active (ADR 0003: sending is disabled during a stream).
 * - `delta` / `citations` only touch the active assistant message while it is `streaming`.
 * - `error` / `abort` / `done` end the stream; the partial text is always kept.
 * - `done` never overwrites a final status (`error` / `aborted`), see P0-05.
 */
export interface ChatStreamState {
  messages: ChatMessage[];
  /** Id of the assistant message currently receiving the stream, or null. */
  activeAssistantId: string | null;
  isStreaming: boolean;
}

export type ChatStreamAction =
  | {
      type: 'start';
      userMessage: ChatMessage;
      assistantMessage: ChatMessage;
      /** Messages removed before appending the new pair (retry of a failed/aborted answer). */
      replacedIds?: readonly string[];
    }
  /** Text accumulated during one animation frame (one or more backend `content` chunks). */
  | { type: 'delta'; text: string }
  | { type: 'citations'; references: CitationReference[] }
  /** `error` is the user-facing text, never the backend technical detail. */
  | { type: 'error'; error: string }
  | { type: 'abort' }
  | { type: 'done' }
  /** Replaces the whole conversation (history selection, new chat) and ends any stream. */
  | { type: 'reset'; messages: ChatMessage[] };

export const initialChatStreamState: ChatStreamState = {
  messages: [],
  activeAssistantId: null,
  isStreaming: false,
};

/** Applies `patch` to the active assistant message if it is still streaming. */
function patchActive(state: ChatStreamState, patch: (message: ChatMessage) => ChatMessage): ChatMessage[] {
  const { activeAssistantId } = state;
  if (activeAssistantId === null) return state.messages;
  let changed = false;
  const messages = state.messages.map((m) => {
    if (m.id !== activeAssistantId || m.status !== 'streaming') return m;
    changed = true;
    return patch(m);
  });
  return changed ? messages : state.messages;
}

/** Ends the active stream, optionally finalizing the active message. */
function endStream(state: ChatStreamState, finalize?: (message: ChatMessage) => ChatMessage): ChatStreamState {
  return {
    messages: finalize ? patchActive(state, finalize) : state.messages,
    activeAssistantId: null,
    isStreaming: false,
  };
}

export function chatStreamReducer(state: ChatStreamState, action: ChatStreamAction): ChatStreamState {
  switch (action.type) {
    case 'start': {
      if (state.isStreaming) return state;
      const replaced = new Set(action.replacedIds ?? []);
      return {
        messages: [
          ...state.messages.filter((m) => !replaced.has(m.id)),
          action.userMessage,
          { ...action.assistantMessage, status: 'streaming' },
        ],
        activeAssistantId: action.assistantMessage.id,
        isStreaming: true,
      };
    }
    case 'delta': {
      if (!state.isStreaming || action.text === '') return state;
      const messages = patchActive(state, (m) => ({ ...m, content: m.content + action.text }));
      return messages === state.messages ? state : { ...state, messages };
    }
    case 'citations': {
      if (!state.isStreaming || action.references.length === 0) return state;
      const messages = patchActive(state, (m) => ({
        ...m,
        citations: [...(m.citations ?? []), ...action.references],
      }));
      return messages === state.messages ? state : { ...state, messages };
    }
    case 'error':
      if (!state.isStreaming) return state;
      return endStream(state, (m) => ({ ...m, status: 'error', error: action.error }));
    case 'abort':
      if (!state.isStreaming) return state;
      return endStream(state, (m) => ({ ...m, status: 'aborted' }));
    case 'done':
      if (!state.isStreaming) return state;
      return endStream(state, (m) => ({ ...m, status: 'completed' }));
    case 'reset':
      return { messages: action.messages, activeAssistantId: null, isStreaming: false };
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}
