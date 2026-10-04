# DocFact Chat & Citations — Frontend Technical Test

Frontend application built with **React 19**, **Next.js 15 (App Router)**, and **TypeScript** for the Frontend Software Engineer Technical Test.

The application implements a document-grounded chatbot interface consuming a backend REST API with **NDJSON streaming**, real-time Markdown/HTML progressive rendering, actionable citations, and a PDF Fact-Checking Viewer with normalized bounding box overlays.

---

## 1. Prerequisites & Installation

### Prerequisites

**Node.js**: v20.19+ or v22.13+ (recommended v22, as in the Dockerfile).  
Versions are pinned by dependencies: `jsdom` (`^20.19.0 || ^22.13.0 || >=24.0.0`), `vitest` (`^20.0.0 || ^22.0.0 || >=24.0.0`), and `@playwright/test` (`>=20`) in `package-lock.json`.

**Package manager**: npm (lockfile: `package-lock.json`).

**Running Backend**: FastAPI backend instance (defaults to `http://localhost:8000`).

#### Project Layout

The backend and frontend are separate repositories. Before starting, clone both:

```
<workspace>/
├── test-tecnico-frontend-engineer/       # Backend repo (see https://github.com/datapizzaorg-ai-lab/test-tecnico-frontend-engineer)
│   ├── backend/                          # FastAPI server
│   ├── docker-compose.yml
│   └── README.md
└── <this-repo>/                          # Frontend (Next.js)
    ├── docker-compose.yml                # Orchestrates both services
    └── README.md
```

To develop locally, start the backend first from its directory:
```bash
cd ../test-tecnico-frontend-engineer
docker-compose up --build
```
This will expose the backend at `http://localhost:8000`. Then, in this frontend repo, run `npm run dev`.

### Installation
```bash
# Clone the repository
git clone <repo-url>
cd <repo-folder>

# Install dependencies (clean install from lock file)
npm ci
```

### Running the Frontend

**Development:**
```bash
# Start development server on port 3000
npm run dev
```

**Production build:**
```bash
npm run build
npm start
```

**Note on standalone output:** Next.js is configured with `output: 'standalone'` in `next.config.ts:11` for Docker efficiency (reducing image size by excluding unnecessary files). When running `npm start`, Next.js prints a warning: `⚠ "next start" does not work with "output: standalone" configuration. Use "node .next/standalone/server.js" instead.` The server responds normally and the application is accessible at `http://localhost:3000`, but the recommended way to run the production build is via the `Dockerfile`, which properly copies the standalone output (`.next/standalone/`, `.next/static/`, and `public/`) and executes `node server.js`.

The application will be accessible at: `http://localhost:3000`.

### Quality Gate

```bash
# Type checking, linting, and unit/integration tests
npm run typecheck
npm run lint
npm run test

# End-to-end tests (requires running backend)
npm run e2e
```

---

## 2. Docker and Backend Configuration

### Backend URL Configuration

The backend URL is configured at **build time** (at compile time, before the server runs):

```env
# .env or .env.local (used during `npm run build`)
BACKEND_URL=http://localhost:8000
```

Default: `http://localhost:8000`.

**How it works:** The `next.config.ts` reads `BACKEND_URL` during build and creates a same-origin proxy on `/api/*` via Next.js `rewrites` (detailed in section 4).

### Running with Docker Compose

**Prerequisites:**
- Docker and Docker Compose installed.
- Backend repository as a sibling directory: `../test-tecnico-frontend-engineer/`.

**Build and Run:**
```bash
# From the frontend directory, start both services together
docker compose up --build -d
```

The application will be accessible at `http://localhost:3000`.

**Configuration details:**
- `BACKEND_URL` is a build-time Docker argument (default in Dockerfile: `http://backend:8000`). To override it:
  ```bash
  docker build --build-arg BACKEND_URL=http://custom-backend:8000 -t docfact-frontend .
  ```
- Backend port 8000 is **intentionally not published** to the host in `docker-compose.yml`, avoiding clashes with locally running backends. The frontend communicates with the backend over the internal Docker Compose network. To expose Swagger at `http://localhost:8000/docs`, uncomment the `ports` section in `docker-compose.yml`.
- The container runs as non-root user `nextjs` (uid 1001; `Dockerfile` line 32).
- Backend data volume is mounted read-only (`../test-tecnico-frontend-engineer/backend/data:/app/data:ro`; `docker-compose.yml` line 11).
- Backend health check (`python -c "import urllib.request; ..."`; `docker-compose.yml` lines 16–20) ensures the frontend starts only after the backend is ready.

### Cookie Authentication

The backend sets a `user_id` cookie on `POST /api/auth/login`. The frontend:
- Does **not** store or simulate tokens; il cookie `user_id` è gestito dal browser. Lo `user_id` in chiaro è comunque salvato anche in `localStorage` (chiave `docfact_auth_user_id`, `services/auth-service.ts`) per ripristinare l'interfaccia.
- Uses `credentials: 'same-origin'` in all requests (see `services/api-client.ts`).
- Relies on the browser to manage the session cookie automatically on subsequent calls (`/api/documents/`, `/api/chat/`, etc.).

The proxy ensures all requests appear same-origin to the browser, allowing secure cookie handling without CORS complications.

---

## 3. Architecture & Project Structure

The project decouples presentation components, business logic, domain models, and API transport:

```
├── app/
│   ├── page.tsx                 # Root route (login or chat workspace)
│   ├── layout.tsx               # Global layout
│   └── globals.css              # Global styles
├── types/
│   ├── api.ts                   # Generic async state, errors, network types
│   ├── auth.ts                  # Auth models and login payloads
│   ├── document.ts              # Document and upload domain models
│   ├── citation.ts              # Citations, RectInches, BoundingRegion types
│   └── chat.ts                  # ChatMessage, ChatSummary, StreamChunk contracts
├── services/
│   ├── api-client.ts            # Central fetch wrapper (relative URLs, same-origin credentials, error normalization)
│   ├── auth-service.ts          # Login validation (ASCII [a-zA-Z0-9_-], max 100), cookie handling
│   ├── document-service.ts      # List documents, multipart upload (files field), blob retrieval
│   └── chat-service.ts          # Chat history, chat details, NDJSON stream consumer
├── utils/
│   ├── ndjson.ts                # Robust NDJSON chunk buffer parser (handles mid-character splits, malformed lines)
│   └── coordinates.ts           # Inch-to-pixel coordinate math (72 DPI)
├── components/
│   ├── auth/
│   │   └── LoginForm.tsx        # User login, client validation, presets
│   ├── documents/
│   │   ├── DocumentListModal.tsx     # Document library, status, direct viewer trigger
│   │   └── DocumentUploadDropzone.tsx # Multipart PDF uploader with drag-and-drop
│   ├── chat/
│   │   ├── ChatWorkspace.tsx    # Primary workspace orchestration
│   │   ├── ChatSidebar.tsx      # Chat history, new chat, doc library shortcut, user info
│   │   ├── ChatComposer.tsx     # Auto-resizing query input with stream abort support
│   │   ├── ChatMessageItem.tsx  # Message renderer (user, streaming, error, retry, citations)
│   │   ├── MarkdownRenderer.tsx # React-markdown + remark-gfm + rehype-raw + rehype-sanitize
│   │   └── RelatedDocumentsSection.tsx # Actionable citation cards
│   ├── pdf/
│   │   ├── PdfFactCheckViewer.tsx    # PDF fact-checking viewer with canvas & navigation
│   │   └── BoundingBoxOverlay.tsx    # Responsive percentage-based bounding box highlights
├── src/
│   └── mocks/                   # MSW handlers and server for testing (NDJSON streaming, auth, documents)
├── tests/
│   ├── fixtures/                # Mock chat responses
│   ├── unit/                    # Unit tests (Vitest + @testing-library/react)
│   └── integration/             # Integration tests (MSW + Vitest)
├── e2e/                         # End-to-end tests (Playwright)
├── vitest.config.ts             # Vitest configuration (jsdom environment)
├── vitest.setup.ts              # Global test setup (@testing-library/jest-dom, MSW)
├── playwright.config.ts         # Playwright configuration
└── next.config.ts               # Next.js configuration (same-origin proxy)
```

**Key structure notes:**
- `services/api-client.ts` uses relative URLs (`/api/...`), relying on the `next.config.ts` proxy to forward to the backend.
- `components/chat/MarkdownRenderer.tsx` uses `react-markdown` with `rehype-raw` (HTML pass-through) and `rehype-sanitize` (XSS protection).
- Test infrastructure: Vitest + RTL for unit/integration (`npm run test`), Playwright for e2e (`npm run e2e`).
- `utils/sanitize.ts` non esiste più (usava DOMPurify); sanitization is now handled by `rehype-sanitize` in the Markdown pipeline.

---

## 4. Proxy & Backend Integration

### Same-Origin Proxy

The `next.config.ts` configures a same-origin proxy for `/api/*` endpoints:

```typescript
rewrites: async () => [
  { source: '/api/:path*/', destination: `${BACKEND_URL}/api/:path*/` },
  { source: '/api/:path*', destination: `${BACKEND_URL}/api/:path*` }
]
```

**Why two rules?** With the sole `:path*` rule the trailing slash is dropped, and FastAPI answers with a 307 redirect to an absolute backend URL (`http://localhost:8000/api/chat/`), which escapes the proxy. The first rule (slash-preserving) must therefore come first. `skipTrailingSlashRedirect: true` (also in `next.config.ts`) stops Next.js from redirecting `/api/chat/` to `/api/chat`, which would break POST requests through the proxy.

The client calls only relative URLs (`/api/auth/login`, `/api/documents/`, `/api/chat/`); the proxy transparently forwards them to `http://localhost:8000` (or the configured `BACKEND_URL`). The browser sees a single origin (`localhost:3000`) for cookies.

See `docs/adr/0001-proxy-same-origin.md` for detailed motivation, alternatives, and Docker implications.

---

## 5. Key Implementation Details

### How NDJSON Streaming is Handled

Network chunks received over `ReadableStream<Uint8Array>` do **not** reliably match line boundaries: a single chunk can split a multi-byte UTF-8 character, cut a JSON string in half, or contain multiple lines.

In `utils/ndjson.ts`:
1. Feed bytes through `TextDecoder({ stream: true })`.
2. Accumulate incoming text in a persistent string `buffer`.
3. Split on newlines `/\r?\n/`.
4. Keep the trailing incomplete piece in the buffer until the next network packet arrives.
5. Parse complete lines with `JSON.parse`; parse failures are converted into `NDJSONParseError`.
6. Supported event types (discriminated union):
   - `{"type": "content", "delta": "<string>"}`: Appends text incrementally.
   - `{"type": "citations", "references": [...]}`: Final chunk with document citations.
   - `{"type": "error", "message": "<string>"}`: Error message displayed to the user.
7. A malformed line (invalid JSON or missing string `type`) throws `NDJSONParseError`: `components/chat/ChatWorkspace.tsx` marks the message as `error` and shows an italian message (`NDJSON_PARSE_ERROR_MESSAGE`), keeping the partial text. Unknown `type` values are ignored (`console.debug` outside production) and the stream continues.
8. Support for `AbortController`: Clicking "Interrompi" halts the stream immediately, preserves the partial answer with state `aborted`, and provides a "Riprova" (Retry) action.

### PDF Rendering & Bounding-Box Coordinate System
The backend returns bounding box coordinates in `rects_in: [[x, y, width, height]]` in **inches**, alongside `page_number`.

#### Normalization & Scaling
- In digital printing and PDF standards, **1 inch = 72 PostScript points** (`DPI = 72`).
- When `pdfjs-dist` loads a page, `page.getViewport({ scale: 1 })` provides the natural width and height of the page in points (`pageWidthPt`, `pageHeightPt`).
- In `utils/coordinates.ts`:
  ```ts
  const pageWidthInches = pageWidthPt / 72;
  const pageHeightInches = pageHeightPt / 72;

  const leftPercent = (x / pageWidthInches) * 100;
  const topPercent = (y / pageHeightInches) * 100;
  const widthPercent = (width / pageWidthInches) * 100;
  const heightPercent = (height / pageHeightInches) * 100;
  ```
- An absolute overlay container (`BoundingBoxOverlay.tsx`) sits directly on top of the rendered PDF canvas.
- Rectangles are defined using **CSS percentages** (`left: X%`, `top: Y%`, `width: W%`, `height: H%`), allowing the bounding boxes to scale with zoom levels (`0.6x` to `3.0x`), screen resize events, and window DPI changes.
- **Multiple Rectangles**: The viewer renders all bounding rectangles in a citation, badges them with region indices, and displays tooltip snippets on hover.
- **Origin Flexibility**: Top-left origin is standard for OCR extraction tools (Azure Document Intelligence, Textract). A toggle in the viewer toolbar also allows switching to bottom-left origin if raw PostScript PDF coordinates are ever emitted.
- **Graceful Degradation**: If a document binary fails to load, the viewer displays a structured fallback containing the page number, citation text quote, and coordinate metadata.

### Safe Markdown and HTML Rendering

Assistant responses may contain Markdown (lists, blockquotes, code blocks) and inline HTML elements (tables, `<strong>`, `<ul>`).

In `components/chat/MarkdownRenderer.tsx`:
1. `react-markdown` parses the Markdown source.
2. `remark-gfm` adds GitHub Flavored Markdown extensions (tables, strikethrough).
3. `rehype-raw` permits raw HTML pass-through (for `<table>`, `<strong>`, etc.).
4. `rehype-sanitize` (with `defaultSchema`), placed after `rehype-raw`, removes script tags and dangerous attributes (`onclick`, `onerror`). Link `href` accettati solo con schema `http`, `https` o `mailto` (`SAFE_LINK` in `components/chat/MarkdownRenderer.tsx`); i test in `tests/unit/MarkdownRenderer.test.tsx` coprono `<script>`, `onerror` e `javascript:`.

No pre-processing with DOMPurify; the sanitization pipeline is: Markdown → AST → rehype-sanitize → DOM.

Tables are wrapped in a horizontally scrolling container for mobile usability.

**Security model:** the sanitizer uses the library default schema; the output is not trusted blindly. Allowlist customization can be added via `rehype-sanitize` config.

### Chat History Consistency
Both active live chat sessions and previously stored sessions loaded from `GET /api/chat/{chat_id}` pass through the same `ChatMessageItem` and `MarkdownRenderer` components (`components/chat/`). This ensures visual and functional consistency across new and historical conversations, using the same Markdown pipeline and sanitization.

---

## 6. Architectural Decisions & Trade-Offs

1. **Same-origin proxy with `next.config.ts` `rewrites`** (P0-03):
   - **Decision:** Use Next.js rewrites to proxy `/api/*` → `${BACKEND_URL}/api/*`.
   - **Rationale:** Starlette 0.50.0 (unpinned) returns `Access-Control-Allow-Origin: *` with credentials, which browsers reject. A same-origin proxy sidesteps CORS by making all requests appear to come from the same origin (`localhost:3000`).
   - **Trade-off:** Backend URL is fixed at build time; runtime switching requires a rebuild. Docker build arg (P0-07) enables passing `BACKEND_URL` at image build time.
   - **Alternatives:** CORS middleware on backend (out of scope), explicit route handler proxy (more verbose), static export (incompatible with rewrites).
   - **See:** `docs/adr/0001-proxy-same-origin.md`.

2. **`rehype-sanitize` for XSS protection** (P0-04):
   - **Decision:** Sanitize Markdown rendering with `rehype-sanitize` after `rehype-raw` (not before, not with DOMPurify).
   - **Rationale:** Pipeline-native, doesn't require additional libraries, works on the AST before DOM insertion.
   - **Trade-off:** default schema only; no custom allowlist.

3. **Direct `pdfjs-dist` Canvas Rendering**:
   - Native `<iframe>`/`<embed>` lack programmatic DOM overlay access. Canvas rendering enables pixel-accurate overlays and multi-scale zooming.
   - Dynamically imported in `useEffect` to avoid SSR hydration mismatches.

4. **Streaming error handling** (P0-05):
   - **Decision:** Distinguish stream errors (`type: "error"`), malformed lines (`NDJSONParseError`) and HTTP errors before the stream (`ApiClientError.statusCode`, `isNetworkError: false`) from network errors.
   - **Rationale:** Users see an italian message (backend text only in `console.error`); a message in `error` is not overwritten by `completed`.

5. **Explicit UX States**:
   Chat messages carry the states `idle`, `streaming`, `completed`, `error` and `aborted` (`MessageStatus` in `types/chat.ts`).

---

## 7. Known Limitations

- **Backend assumptions and design:**
  - **Documents are global** (not per-user): all authenticated users see the same document library (`BE:src/routes/documents.py:120`, `docs/AUDIT.md` Assumption 10). Each user can upload their own documents, but the upload list shows all documents.
  - **`page_count` is a mock**: all documents report exactly 5 pages, regardless of the actual PDF page count (`BE:src/dependencies.py:25`).
  - **`text_quote` is a placeholder**: citations always include the same hardcoded phrase (`BE:src/routes/chat.py:194`), not a real excerpt from the document. This is by design for the test; highlighting specific text in the PDF is therefore not meaningful.
  - **Each chat = one Q/A pair**: the backend creates a new chat record on every `POST /api/chat/` request. The frontend can send a `history` field, but the backend ignores it (not persisted). Multi-turn conversation is managed locally only.
  - **Response types are not in OpenAPI**: all `GET` and `POST` endpoints return `200` with an empty schema `{"schema": {}}` in `docs/api/openapi.json` (generated from the backend source without running it). Real response types are documented in `docs/AUDIT.md` §2 and written by hand in `types/` (no schema validation against OpenAPI).

- **Frontend scope (not yet implemented / planned improvements):**
  - The `POST /api/chat/` request sends `chat_id` in the body (`services/chat-service.ts:64-65`, `components/chat/ChatWorkspace.tsx:211`), but the backend OpenAPI schema does not document this field. The backend likely ignores it (P1-02).
  - Streaming updates the UI on every received character (one state update per chunk, no per-frame batching). Queued renders could be batched with `requestAnimationFrame` for better performance (P1-03).
  - The PDF.js worker and cMaps are loaded from CDN at runtime (`components/pdf/PdfFactCheckViewer.tsx` lines 98 and 103 load from `cdnjs.cloudflare.com` and `cdn.jsdelivr.net`). Bundling these locally would allow fully offline operation in Docker (P1-08).
  - PDF text layer (selectable and copyable text) is not implemented (P1-08).
  - Multi-page continuous scrolling is not implemented; users navigate one page at a time (P1-08).
  - Automatic scroll to the first bounding region when opening a citation is not implemented (P1-08).

- **Minor issues (low severity):**
  - `/favicon.ico` returns 404 (no favicon in the project).
  - Requests to `/api/...` without trailing slash (e.g., `/api/documents` instead of `/api/documents/`) receive a 307 redirect with an absolute backend URL (`http://backend:8000/...`), which is unreachable from the browser. The application always uses the trailing slash, so this does not affect normal operation.

- **Validation details:**
  - Client `user_id` validation is more restrictive than the backend: only ASCII `[a-zA-Z0-9_-]` (max 100 chars), vs backend `str.isalnum()` which accepts Unicode. The backend is lenient; the client enforces stricter rules.

- **Testing note:**
  - E2E tests (Playwright) require a running backend instance. Unit and integration tests (Vitest + MSW) do not.

---

## 8. With More Time

This section tracks planned improvements aligned with the evaluation criteria and UX enhancements (items from `docs/ROADMAP.md`):

**Feature structure and API layer (P1-01):** Refactor into feature-based directories (`src/features/{auth,documents,chat,factcheck,history}/`) with dedicated hooks and typed API client. Split `ChatWorkspace.tsx` (currently 562 lines) into smaller, testable units.

**API types from OpenAPI (P1-02):** Generate request types from `docs/api/openapi.json` with `openapi-typescript`; write response types by hand (OpenAPI lacks them). Add validation and remove speculative field normalization.

**Stream batching with `requestAnimationFrame` (P1-03):** Accumulate `content` deltas and render once per frame instead of on every character. When 500 consecutive `content` chunks are delivered in a single tick, the message component should re-render at most 5 times instead of 500.

**User-friendly error messages (P1-04):** Map backend error codes and network errors to Italian messages without exposing technical details (no status codes, no URLs, no stack traces).

**Session and 401 handling (P1-05):** Redirect to login on any 401; prevent hydration mismatches by deferring `localStorage` access.

**Server state with TanStack Query (P1-06):** Use `useQuery` and `useMutation` for documents and chat history with proper loading and error states (sidebar currently hardcodes `loading: false`).

**Chat history model (P1-07):** Formalize the backend's Q/A model (one chat = one pair) and align the UI (no multi-turn state in backend, local only).

**PDF.js worker and cMaps locally (P1-08):** Bundle PDF.js worker and cMap files instead of loading from CDN, enabling offline operation in Docker.

**Side-by-side layout (P1-09):** Show conversation and PDF viewer side by side on ≥1024 px; modal on smaller screens.

**Keyboard navigation (P1-10):** Make citations and buttons keyboard-accessible; test with Playwright.

**Highlight bidirectional sync (P2-01):** Clicking a bounding box highlights its citation card; hovering a card highlights its boxes.

**Page thumbnail with regions (P2-02):** Show mini-previews of cited pages with bounding boxes rendered inline (lazy-loaded).

**Markdown stability (P2-03):** Test that streaming HTML tables never render as escaped text in snapshots.

**Chat and document pagination (P2-04):** Implement `limit`/`offset` for lists with "Load more" buttons.

**Upload cancellation (P2-05):** Add an abort button during multipart upload.

**Accessibility and language (P2-06):** Set `<html lang="it">`; audit with axe-core for WCAG violations.

**Dark mode (P2-07):** Implement color scheme toggle with 4.5:1 contrast ratio for text.

---

## 9. Sviluppo con Claude Code (team di subagenti)

Il lavoro sul frontend è orchestrato con Claude Code: `CLAUDE.md` (regole dell'orchestratore), `.claude/agents/` (subagenti: `frontend-developer`, `frontend-test-writer`, `frontend-tester`, `documentation-writer`), `.claude/hooks/` (guard, quality gate, validazione output) e `docs/ROADMAP.md` (piano).

Limiti noti degli hook:
- `.claude/hooks/guard-orchestrator.mjs` impedisce al thread principale di modificare file fuori da `.claude/` e `CLAUDE.md`. Il controllo sui comandi **Bash** è **best-effort**: riconosce i pattern di scrittura comuni (`sed -i`, `perl -i`, `tee`, redirezioni `>`/`>>`, `cp`, `mv`, `rm`, `git apply`, `git checkout --`, `--write`, `--fix`, `npm install`), ma non ogni possibile scrittura via shell (ad esempio script eseguiti con `node -e` o `python -c`).
- Il quality gate (`.claude/hooks/quality-gate.mjs`) esegue `typecheck`, `lint` e `test`, non gli e2e, che richiedono il backend avviato.
