import { CitationReference } from './citation';

export type MessageRole = 'user' | 'assistant' | 'system';
export type MessageStatus = 'idle' | 'streaming' | 'completed' | 'error' | 'aborted';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  created_at?: string;
  status: MessageStatus;
  error?: string;
  citations?: CitationReference[];
}

export interface ChatSummary {
  id: string;
  chat_id?: string;
  title?: string;
  query?: string;
  created_at?: string;
  updated_at?: string;
  message_count?: number;
  preview?: string;
  [key: string]: unknown;
}

export interface ChatDetail {
  id: string;
  chat_id?: string;
  title?: string;
  messages: Array<{
    id?: string;
    role: string;
    content?: string;
    query?: string;
    response?: string;
    text?: string;
    created_at?: string;
    citations?: CitationReference[];
    references?: CitationReference[];
    [key: string]: unknown;
  }>;
  created_at?: string;
  [key: string]: unknown;
}

export interface ChatRequest {
  query: string;
  history?: Array<{
    role: string;
    content: string;
  }>;
  chat_id?: string;
}

export type StreamChunk =
  | { type: 'content'; delta: string }
  | { type: 'citations'; references: CitationReference[] }
  | { type: 'error'; message: string } // BE:src/routes/chat.py:209;
