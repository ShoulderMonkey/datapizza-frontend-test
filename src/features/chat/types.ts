import type { CitationReference } from '@/src/api';
export type { ChatHistoryEntry, ChatRequest, CitationReference, StreamChunk } from '@/src/api';

export type MessageRole = 'user' | 'assistant' | 'system';
export type MessageStatus = 'idle' | 'streaming' | 'completed' | 'error' | 'aborted';

/** A message as rendered in the conversation (UI model, not a wire type). */
export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  created_at?: string;
  status: MessageStatus;
  /** User-facing error text (never the backend technical detail). */
  error?: string;
  citations?: CitationReference[];
}
