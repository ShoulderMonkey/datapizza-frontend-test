/**
 * Wire types of the backend API (requests, responses, stream chunks).
 *
 * docs/api/openapi.json does not describe response bodies (docs/AUDIT.md Assunzione 2):
 * response shapes come from docs/AUDIT.md §2. They are kept as they were before P1-01;
 * P1-02 replaces them with OpenAPI-generated request types and exact response types.
 *
 * This module belongs to the API layer and must not import from src/features/**.
 */

// --- Auth -------------------------------------------------------------------

export interface LoginRequest {
  user_id: string;
}

export interface LoginResponse {
  status?: string;
  message?: string;
  user_id?: string;
  [key: string]: unknown;
}

// --- Citations / bounding boxes ---------------------------------------------

/**
 * Bounding rectangle coordinate tuple: [x, y, width, height] in inches.
 * Origin top-left, y grows downwards (docs/AUDIT.md §2).
 */
export type RectInches = [x: number, y: number, width: number, height: number];

export interface BoundingRegion {
  /** 1-based page number. */
  page_number: number;
  rects_in: RectInches[];
}

export interface CitationReference {
  document_id: string;
  filename: string;
  page_number: number;
  text_quote: string;
  bounding_regions?: BoundingRegion[];
}

// --- Documents --------------------------------------------------------------

export interface DocumentItem {
  id: string;
  document_id?: string;
  filename: string;
  created_at?: string;
  upload_date?: string;
  size_bytes?: number;
  size?: number | string;
  page_count?: number;
  status?: string;
  [key: string]: unknown;
}

export interface DocumentUploadResponse {
  uploaded?: DocumentItem[];
  documents?: DocumentItem[];
  message?: string;
  status?: string;
  [key: string]: unknown;
}

// --- Chat -------------------------------------------------------------------

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

/** One message of a stored conversation, normalized by `chatService.getChat`. */
export interface ChatTranscriptMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
  citations?: CitationReference[];
}

export interface ChatTranscript {
  id: string;
  title: string;
  messages: ChatTranscriptMessage[];
}

export interface ChatHistoryEntry {
  role: string;
  content: string;
}

export interface ChatRequest {
  query: string;
  history?: ChatHistoryEntry[];
  /** Not part of the backend schema (docs/AUDIT.md §2): removed by P1-02. */
  chat_id?: string;
}

/** NDJSON chunks of POST /api/chat/ (discriminated union on `type`). */
export type StreamChunk =
  | { type: 'content'; delta: string }
  | { type: 'citations'; references: CitationReference[] }
  | { type: 'error'; message: string }; // BE:src/routes/chat.py:207-210

// --- UI-side status of an async API operation ------------------------------

/** Explicit state of every async operation (login, upload, send, history, PDF). */
export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';
