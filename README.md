# DocFact Chat & Citations — Frontend Technical Test

Frontend application built with **React 19**, **Next.js 15 (App Router)**, and **TypeScript** for the Frontend Software Engineer Technical Test.

The application implements a document-grounded chatbot interface consuming a backend REST API with **NDJSON streaming**, real-time Markdown/HTML progressive rendering, actionable citations, and a **high-fidelity PDF Fact-Checking Viewer** with normalized bounding box overlays.

---

## 1. Prerequisites & Installation

### Prerequisites
- **Node.js**: v18.17+ or v20+
- **Package manager**: npm
- **Running Backend**: FastAPI backend instance (defaults to `http://localhost:8000`)

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

## 2. Backend Configuration

### Backend URL Configuration

The backend URL is configured at **build time**:

```env
# .env or .env.local (during `npm run build`)
BACKEND_URL=http://localhost:8000
```

Default: `http://localhost:8000`.

**How it works:** The `next.config.ts` reads `BACKEND_URL` during build and creates a same-origin proxy on `/api/*` (see section 3 for details).

### Running with Docker

**Prerequisites:**
- Docker and Docker Compose installed.
- Backend repository as a sibling directory: `../test-tecnico-frontend-engineer/backend`.

**Build and Run:**
```bash
# Build the frontend image
docker build -t docfact-frontend .

# Or use docker-compose to start both frontend and backend
docker compose up --build -d
```

The application will be accessible at `http://localhost:3000`.

**Configuration:**
- `BACKEND_URL` is a build-time argument (default: `http://backend:8000`). The rewrites in `next.config.ts` are evaluated at build time and serialized into the routes manifest; changing `BACKEND_URL` requires a rebuild:
  ```bash
  docker build --build-arg BACKEND_URL=http://custom-backend:8000 -t docfact-frontend .
  ```
- Backend port 8000 is **intentionally not published** to the host (avoiding clashes with locally running backends). The frontend communicates with the backend over the internal Docker Compose network. To expose Swagger at `http://localhost:8000/docs`, uncomment the `ports` section in `docker-compose.yml`.
- The container runs as non-root user `nextjs` (uid 1001, see `Dockerfile` line 32).

**Docker Compose Details:**
- Backend builds from `../test-tecnico-frontend-engineer/backend` (see `docker-compose.yml` line 7).
- Frontend build args are passed via `build.args.BACKEND_URL` (line 27).
- Backend health check (`python -c "import urllib.request; ..."`; line 16-20) ensures the frontend only starts after the backend is ready.
- Backend data volume is mounted read-only (`../test-tecnico-frontend-engineer/backend/data:/app/data:ro`; line 11).

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
- By defining rectangles using **CSS percentages** (`left: X%`, `top: Y%`, `width: W%`, `height: H%`), the bounding boxes remain **100% aligned and responsive** across arbitrary zoom levels (`0.6x` to `3.0x`), screen resize events, and window DPI changes.
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
Both active live chat sessions and previously stored sessions loaded from `GET /api/chat/{chat_id}` pass through the exact same `ChatMessageItem` and `MarkdownRenderer` components. This guarantees 100% visual and functional consistency across new and historical conversations.

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

- **Backend assumptions:**
  - Documents are global (not per-user); `page_count` is a mock constant (all documents report 5 pages).
  - Each chat is a single Q/A pair; multi-turn history is local-only and not persisted by the backend.
  - `text_quote` in citations is a placeholder (always the same string); highlighting in the PDF text layer is not meaningful.
  - Chat details (`GET /api/chat/{chat_id}`) returns a flat object; there's no separate endpoint for chat messages.

- **Frontend scope (not yet implemented / todo):**
  - Streaming renders on every received chunk (one state update per chunk, no per-frame batching). See P1-03.
  - `chat_id` is still sent in the body of `POST /api/chat/` (`services/chat-service.ts`). See P1-02.
  - The PDF.js worker and cMaps are loaded from a CDN at runtime (`components/pdf/PdfFactCheckViewer.tsx:98,103`), not bundled locally. The Docker image is therefore not fully offline-capable. See P1-08.
  - PDF text layer (selectable, copyable text) is not implemented. See P1-08.
  - Multi-page continuous scroll is not implemented; users navigate page-by-page. See P1-08.
  - Bounding-box scroll-to (automatic scroll to the first region when opening a citation) is not implemented. See P1-08.

- **Minor issues (low severity):**
  - `/favicon.ico` returns 404 (no favicon in the project).
  - Requests to `/api/...` without trailing slash (e.g., `/api/documents` instead of `/api/documents/`) receive a 307 redirect with an absolute backend URL (`http://backend:8000/...`), which is unreachable from the browser. The application always uses the trailing slash, so this does not affect normal operation.

- **Validation details:**
  - Client `user_id` validation is more restrictive than the backend: only ASCII `[a-zA-Z0-9_-]` (max 100 chars), vs backend `str.isalnum()` which accepts Unicode. The backend is lenient; the client enforces stricter rules.

- **Testing note:**
  - E2E tests (Playwright) require a running backend instance. Unit and integration tests (Vitest + MSW) do not.

## 8. Sviluppo con Claude Code (team di subagenti)

Il lavoro sul frontend è orchestrato con Claude Code: `CLAUDE.md` (regole dell'orchestratore), `.claude/agents/` (subagenti), `.claude/hooks/` (guard, quality gate, validazione output) e `docs/ROADMAP.md` (piano).

Limiti noti degli hook:
- `.claude/hooks/guard-orchestrator.mjs` impedisce al thread principale di modificare file fuori da `.claude/` e `CLAUDE.md`. Il controllo sui comandi **Bash** è **best-effort**: riconosce i pattern di scrittura comuni (`sed -i`, `perl -i`, `tee`, redirezioni `>`/`>>`, `cp`, `mv`, `rm`, `git apply`, `git checkout --`, `--write`, `--fix`, `npm install`), ma non ogni possibile scrittura via shell (ad esempio script eseguiti con `node -e` o `python -c`).
- Il quality gate (`.claude/hooks/quality-gate.mjs`) esegue `typecheck`, `lint` e `test`, non gli e2e, che richiedono il backend avviato.
