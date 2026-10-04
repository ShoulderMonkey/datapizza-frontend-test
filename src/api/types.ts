/**
 * Wire types of the backend API (requests, responses, stream chunks).
 *
 * docs/api/openapi.json does not describe response bodies (docs/AUDIT.md Assunzione 2):
 * request types derive from the generated `schema.d.ts` (`npm run gen:api`), response shapes
 * are written by hand from docs/AUDIT.md §2.
 *
 * This module belongs to the API layer and must not import from src/features/**.
 */

import type { components } from './schema';

// --- Auth -------------------------------------------------------------------

export type LoginRequest = components['schemas']['LoginRequest'];

/** POST /api/auth/login: BE:src/routes/auth.py:42 (docs/AUDIT.md §2). */
export interface LoginResponse {
  user_id: string;
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

/** Element of GET /api/documents/ and of `UploadResponse.documents` (docs/AUDIT.md §2). */
export interface Document {
  id: string;
  filename: string;
  content_type: string;
  upload_date: string;
  status: string;
  page_count: number;
  file_hash: string;
}

/** POST /api/documents/ (docs/AUDIT.md §2). */
export interface UploadResponse {
  message: string;
  documents: Document[];
}

// --- Chat -------------------------------------------------------------------

/** One stored chat = one Q/A pair; element of GET /api/chat/ (bare array) and GET /api/chat/{id}. */
export interface ChatRecord {
  id: string;
  user_id: string;
  created_at: string;
  query: string;
  response: string;
  citations?: CitationReference[];
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

/** Element of `ChatRequest.history` (the backend ignores `history`, docs/AUDIT.md §2). */
export type ChatHistoryEntry = { role: string; content: string };

/** Body of POST /api/chat/: generated from OpenAPI (docs/AUDIT.md §2). */
export type ChatRequest = components['schemas']['ChatRequest'];

/** NDJSON chunks of POST /api/chat/ (discriminated union on `type`). */
export type StreamChunk =
  | { type: 'content'; delta: string }
  | { type: 'citations'; references: CitationReference[] }
  | { type: 'error'; message: string }; // BE:src/routes/chat.py:207-210

// --- UI-side status of an async API operation ------------------------------

/** Explicit state of every async operation (login, upload, send, history, PDF). */
export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';
