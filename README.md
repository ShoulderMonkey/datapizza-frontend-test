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

# Regenerate API request types from docs/api/openapi.json
npm run gen:api
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
- **npm 11 per il lockfile:** `package.json` dichiara `"packageManager": "npm@11.6.2"` (riga 5) e il deps stage del `Dockerfile` (righe 7-9) installa `npm@11.6.2` prima di `npm ci`. Rigenera `package-lock.json` con npm 11, altrimenti `npm ci` nel container fallisce (l'npm 10 di `node:22-alpine` lo considera non sincronizzato).
- The container runs as non-root user `nextjs` (uid 1001; `Dockerfile` line 32).
- Backend data volume is mounted read-only (`../test-tecnico-frontend-engineer/backend/data:/app/data:ro`; `docker-compose.yml` line 11).
- Backend health check (`python -c "import urllib.request; ..."`; `docker-compose.yml` lines 16–20) ensures the frontend starts only after the backend is ready.

### Cookie Authentication

Il backend imposta il cookie `user_id` su `POST /api/auth/login`: HttpOnly, SameSite=lax, senza `Max-Age` (cookie di sessione del browser, `docs/AUDIT.md` §2). Il frontend:
- Non salva né simula token; il cookie `user_id` è gestito dal browser e inviato con `credentials: 'same-origin'` (`src/api/client.ts`).
- Salva lo `user_id` in `localStorage` (chiave `docfact_auth_user_id`, `src/features/auth/lib/session-storage.ts`) solo come convenienza UI. `useSession` (`src/features/auth/hooks/useSession.ts`) parte sempre in stato `hydrating` e legge lo storage in un `useEffect`, dopo il mount: nessun accesso a `localStorage` durante il render, quindi nessun hydration mismatch. Finché lo stato è `hydrating`, `app/page.tsx` mostra un placeholder `role="status"`.
- Gestisce il 401 in un punto solo: `src/api/session.ts` (`setUnauthorizedHandler`, `notifyUnauthorized`). Il client chiama `notifyUnauthorized()` per ogni 401 tranne `/api/auth/login` (`src/api/client.ts`); più 401 concorrenti producono una sola notifica. L'handler registrato da `useSession` svuota lo storage, porta lo stato ad `anonymous` e mostra "Sessione scaduta, accedi di nuovo" (`session_expired` in `src/api/errorMessages.ts`) nella schermata di login.
- Logout: svuota lo stato utente, lo `user_id` salvato e la cache di TanStack Query (`queryClient.clear()` in `app/page.tsx`). Il backend non espone un endpoint di logout, quindi il cookie `user_id` non viene cancellato: resta finché non viene sovrascritto da un nuovo login o scade con la sessione del browser. Questo è un limite del backend.
- Test: `tests/integration/session-401.test.tsx` (MSW) ed e2e `e2e/session.spec.ts` (reload da loggato senza errori di idratazione; `clearCookies()` + apertura documenti riporta al login).

The proxy ensures all requests appear same-origin to the browser, allowing secure cookie handling without CORS complications.

---

## 3. Architecture & Project Structure

The project uses a **feature-based structure** (P1-01, ADR 0002) that decouples presentation components, business logic, domain models, and API transport:

```
├── app/
│   ├── page.tsx                 # Root route (login or chat workspace)
│   ├── layout.tsx               # Global layout
│   └── globals.css              # Global styles
├── src/
│   ├── api/                     # Centralized API layer (ONLY place with fetch)
│   │   ├── client.ts            # Central fetch wrapper (relative URLs, same-origin credentials)
│   │   ├── errors.ts            # ApiError normalization (status, code, userMessage, cause, detail)
│   │   ├── ndjson.ts            # Robust NDJSON chunk buffer parser (handles mid-character splits, malformed lines)
│   │   ├── types.ts             # Wire types (Document, ChatMessage, User, etc.)
│   │   ├── auth.ts              # POST /api/auth/login
│   │   ├── documents.ts         # GET /api/documents/, POST /api/documents/ (multipart)
│   │   ├── chat.ts              # GET /api/chat/, POST /api/chat/ (streaming)
│   │   └── index.ts             # Barrel exports
│   ├── features/                # Feature-based organization
│   │   ├── auth/
│   │   │   ├── components/      # LoginForm (presentational)
│   │   │   ├── hooks/           # useLogin, useSession (state orchestration)
│   │   │   ├── lib/             # session-storage.ts (pure functions)
│   │   │   └── types.ts         # Auth domain types + wire re-exports
│   │   ├── documents/
│   │   │   ├── components/      # DocumentListModal, DocumentUploadDropzone
│   │   │   ├── hooks/           # useDocumentUpload, useDocuments
│   │   │   └── types.ts         # Document domain types
│   │   ├── chat/
│   │   │   ├── components/      # ChatWorkspace (184 lines), ChatComposer, ChatMessageItem, ChatConversation
│   │   │   ├── hooks/           # useChatStream (useReducer + rAF batching), useAutoScroll
│   │   │   ├── lib/             # chatStreamReducer (pure reducer, no React)
│   │   │   └── types.ts         # StreamChunk, ChatMessage domain types
│   │   ├── factcheck/
│   │   │   ├── components/      # FactCheckPanel, PdfFactCheckViewer, PdfPageView, BoundingBoxOverlay, RelatedDocumentsSection
│   │   │   ├── hooks/           # usePdfDocument, usePdfViewer, useIsDesktop
│   │   │   ├── lib/             # coordinates.ts (inchesRectToPx, 72 pt/inch), pdfWorker.ts, regions.ts
│   │   │   └── types.ts         # BoundingRegion, RectInches domain types
│   │   └── history/
│   │       ├── components/      # ChatSidebar (history list, new chat, user info)
│   │       ├── hooks/           # useChatHistory, useChatList, useChatDetail
│   │       └── types.ts         # History domain types
│   ├── components/
│   │   └── ui/                  # Generic, feature-agnostic components
│   │       ├── MarkdownRenderer.tsx # React-markdown + remark-gfm + rehype-raw + rehype-sanitize (safe HTML rendering)
│   │       └── Spinner.tsx      # Loading indicator
│   └── mocks/                   # MSW handlers and server for testing (NDJSON streaming, auth, documents)
├── tests/
│   ├── fixtures/                # Mock chat responses
│   ├── unit/                    # Unit tests (Vitest + @testing-library/react)
│   │   ├── api-errors.test.ts   # ApiError normalization (network, 4xx, 422, abort)
│   │   └── eslint-no-fetch.test.ts # Verify ESLint forbids fetch outside src/api
│   └── integration/             # Integration tests (MSW + Vitest)
├── e2e/                         # End-to-end tests (Playwright, requires backend)
├── vitest.config.ts             # Vitest configuration (jsdom environment, @/* alias)
├── vitest.setup.ts              # Global test setup (@testing-library/jest-dom, MSW)
├── playwright.config.ts         # Playwright configuration
└── next.config.ts               # Next.js configuration (same-origin proxy for /api/*)
```

**Key structure notes:**

**API layer** (`src/api/`):
- **Unico `fetch`**: `client.ts:48` contiene l'unica dichiarazione `fetch` nel progetto. Verificato con ESLint `no-restricted-globals`.
- **URL relativi**: tutte le funzioni usano `/api/...`, il proxy `next.config.ts` le invia al backend.
- **Errori normalizzati**: tutte le risposte HTTP, i timeout e gli abort diventano `ApiError { status, code, userMessage, cause, detail }`.

**Feature structure** (`src/features/{auth,documents,chat,factcheck,history}/`):
- **`components/`**: Presentazionali (ricevono `props`, chiamano `callbacks`); nessun `fetch` o import da `src/api`.
- **`hooks/`**: Orchestrano stato, chiamano `src/api`, gestiscono effetti. Esempi: `useChatStream` (stato con `useReducer` e `chatStreamReducer`; i `delta` sono accumulati e applicati con `requestAnimationFrame`, vedi §6), `useLogin`, `useDocuments`, `useChatList`, `useChatDetail` (server state con TanStack Query, vedi sotto).
- **`lib/` (optional)**: Funzioni pure senza React (coordinate math, session storage).
- **`types.ts`**: Tipi della feature e re-export da `src/api/types.ts`.

**Generic UI** (`src/components/ui/`):
- `MarkdownRenderer` usa `react-markdown` + `remark-gfm` + `rehype-raw` + `rehype-sanitize` (sanitization **after** raw per supportare HTML tables). Nessun DOMPurify o `dangerouslySetInnerHTML`.

**Dependency graph:**
```
app/ → src/features/{...}/hooks → src/api/
↓
src/features/{...}/components ← src/components/ui/
↓
src/api/ (no outbound dependencies)
```

**Test infrastructure**: Vitest + RTL for unit/integration (`npm run test`), Playwright for e2e (`npm run e2e`, requires backend).

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

In `src/api/ndjson.ts`:
1. Feed bytes through `TextDecoder({ stream: true })`.
2. Accumulate incoming text in a persistent string `buffer`.
3. Split on newlines `/\r?\n/`.
4. Keep the trailing incomplete piece in the buffer until the next network packet arrives.
5. Parse complete lines with `JSON.parse`; parse failures are converted into `NDJSONParseError`.
6. Supported event types (discriminated union):
   - `{"type": "content", "delta": "<string>"}`: Appends text incrementally.
   - `{"type": "citations", "references": [...]}`: Final chunk with document citations.
   - `{"type": "error", "message": "<string>"}`: Error message displayed to the user.
7. A malformed line (invalid JSON or missing string `type`) throws `NDJSONParseError`: `src/features/chat/components/ChatWorkspace.tsx` marks the message as `error` and shows an italian message, keeping the partial text. Unknown `type` values are ignored (`console.debug` outside production) and the stream continues.
8. Support for `AbortController`: Clicking "Interrompi" halts the stream immediately, preserves the partial answer with state `aborted`, and provides a "Riprova" (Retry) action.

### PDF Rendering & Bounding-Box Coordinate System
The backend returns bounding box coordinates in `rects_in: [[x, y, width, height]]` in **inches**, alongside `page_number`.

#### Normalization & Scaling
- **1 inch = 72 PostScript points**: `pt = inch * 72`.
- Il viewer usa `react-pdf` (`src/features/factcheck/components/PdfPageView.tsx`); la larghezza naturale della pagina in punti (`pageWidthPt`) viene letta dalla pagina PDF e la scala di rendering è `scala = px / pt` (`renderedWidthPx / pageWidthPt`).
- In `src/features/factcheck/lib/coordinates.ts` la funzione pura `inchesRectToPx(rect, pageWidthPt, renderedWidthPx)` converte `[x, y, w, h]` in pollici in `{left, top, width, height}` in **pixel**. Esempio (test unit): `[1,1,2,0.5]` su 612 pt a 612 px → `{left:72, top:72, width:144, height:36}`; a 1224 px i valori raddoppiano.
- `BoundingBoxOverlay.tsx` (`data-testid="bbox"`) posiziona i rettangoli in modo assoluto sopra la pagina renderizzata usando questi pixel.
- **Origine top-left**: `y` cresce verso il basso, quindi non c'è inversione dell'asse; l'origine è quella documentata in `BE:tests/bbox_visualization.py:48`. Il selettore di origine (top-left/bottom-left) è stato rimosso.
- **Scroll alla regione**: aprendo una citazione la pagina mostrata è `bounding_regions[0].page_number` e la vista scorre alla prima regione (`PdfPageView.tsx:50`).
- **Pagine con regioni**: se la citazione ha regioni su più pagine, `PdfFactCheckViewer.tsx` mostra l'elenco "Pagine con regioni" con navigazione (raggruppamento in `lib/regions.ts`).
- **Worker locale**: il worker pdf.js è risolto con `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)` in `lib/pdfWorker.ts`, senza CDN.
- **Layout e focus (P1-09)**: `FactCheckPanel.tsx` mostra il viewer come pannello laterale (`role="complementary"`) a ≥ 1024 px, con la conversazione ancora visibile e scrollabile (`useIsDesktop.ts`), e come dialog a schermo intero (`role="dialog"`, `aria-modal`, pulsante di chiusura) sotto. All'apertura il focus va al pannello; `Escape` lo chiude e il focus torna alla card della citazione. La card attiva (`aria-current` in `RelatedDocumentsSection.tsx`) e le sue regioni sul PDF (`data-active` in `BoundingBoxOverlay.tsx`) sono evidenziate. Test: `tests/integration/FactCheckPanel.test.tsx`, `e2e/layout.spec.ts`.
- **Graceful Degradation**: If a document binary fails to load, the viewer displays a structured fallback containing the page number, citation text quote, and coordinate metadata.

### Safe Markdown and HTML Rendering

Assistant responses may contain Markdown (lists, blockquotes, code blocks) and inline HTML elements (tables, `<strong>`, `<ul>`).

In `src/components/ui/MarkdownRenderer.tsx`:
1. `react-markdown` parses the Markdown source.
2. `remark-gfm` adds GitHub Flavored Markdown extensions (tables, strikethrough).
3. `rehype-raw` permits raw HTML pass-through (for `<table>`, `<strong>`, etc.).
4. `rehype-sanitize` (with `defaultSchema`), placed after `rehype-raw`, removes script tags and dangerous attributes (`onclick`, `onerror`). Link `href` accettati solo con schema `http`, `https` o `mailto`; i test in `tests/unit/MarkdownRenderer.test.tsx` coprono `<script>`, `onerror` e `javascript:`.

No pre-processing with DOMPurify; the sanitization pipeline is: Markdown → AST → rehype-sanitize → DOM.

Tables are wrapped in a horizontally scrolling container for mobile usability.

**Security model:** the sanitizer uses the library default schema; the output is not trusted blindly. Allowlist customization can be added via `rehype-sanitize` config.

### Chat History Consistency
Both active live chat sessions and previously stored sessions loaded from `GET /api/chat/{chat_id}` pass through the same `ChatMessageItem` and `MarkdownRenderer` components (`src/features/chat/components/`). This ensures visual and functional consistency across new and historical conversations, using the same Markdown pipeline and sanitization.

### Chat History Model (P1-07)
Una chat del backend è una sola coppia domanda/risposta, quindi ogni voce dello storico ha titolo = `query` e data = `created_at` (con ora), ordinate dalla più recente (`src/features/history/components/ChatSidebar.tsx`); la voce selezionata ha `aria-current`. Selezionare una voce mostra domanda, risposta e "Documenti correlati" con le citazioni salvate. Una nuova domanda (o Riprova) con una voce selezionata avvia una nuova sessione locale: la selezione viene annullata, la voce non cambia e a fine stream compare una nuova voce in cima, non selezionata. Una nota (`HistoryEntryNotice.tsx`) lo spiega sopra il composer. La conversazione multi-turno esiste solo nel client; `history` viene inviato ma il backend lo ignora. Vedi `docs/adr/0004-modello-storico.md`.

### Server State with TanStack Query
Documenti e storico usano `@tanstack/react-query` (`useDocuments`, `useChatList`, `useChatDetail`). Le query key sono condivise in `src/features/queryKeys.ts`, quindi badge e modale dei documenti leggono la stessa cache. Un upload riuscito invalida `queryKeys.documents.all` (`useDocumentUpload.ts`); a fine stream la lista chat viene ricaricata (`onStreamEnd` in `ChatWorkspace.tsx`). Lo storico e ordinato per `created_at` decrescente. La sidebar mostra loading (`role="status"`), errore e pulsante "Riprova". `QueryProvider` (`src/components/providers/QueryProvider.tsx`) crea un `QueryClient` per montaggio con retry massimo 1, nessun retry sugli errori 4xx e `refetchOnWindowFocus: false`. La modale documenti non mostra `page_count`, perche il backend lo restituisce come mock fisso a 5 (limite del backend, `docs/AUDIT.md` §2). Il backend pagina le liste con `limit` 1–100 (default 20) in ordine crescente; per non perdere le chat più recenti il client scarica tutte le pagine con `fetchAllPages` (`src/api/pagination.ts`: `limit=100`, `offset` crescente, stop alla prima pagina incompleta, tetto di 50 pagine), usato da `listChats` e `listDocuments`.

### Error Handling
Tutti i messaggi mostrati all'utente stanno in una sola mappa in italiano, `ERROR_MESSAGES` (`src/api/errorMessages.ts`). `messageKeyFor` sceglie la chiave dal `code` normalizzato di `ApiError`, dall'endpoint e dal testo `detail` del backend (ad esempio query vuota e troppo lunga su `POST /api/chat/` hanno messaggi distinti). Per l'upload rifiutato con 400 "not recognized", `extractRejectedFilename` estrae il nome del file dal `detail` e il messaggio lo cita. `toUserMessage` (`src/api/errors.ts`) restituisce il messaggio della mappa oppure un fallback per contesto, senza mostrare status code, `detail`, stack o URL del backend (unica cifra ammessa: il limite 100 del `user_id`). I dettagli tecnici restano in `ApiError.cause` e vengono scritti solo in `console` da `logError`. Test: `tests/unit/errorMessages.test.ts`, `tests/integration/error-messages-ui.test.tsx` ed e2e `e2e/upload-errors.spec.ts` (upload di un PDF non ammesso).

---

## 6. Architectural Decisions & Trade-Offs

1. **Feature-based project structure with centralized API layer** (P1-01):
   - **Decision:** Organize code as `src/features/{auth,documents,chat,factcheck,history}/` with components, hooks, and types per feature; a single `src/api/` module handles all HTTP requests.
   - **Rationale:** Decouples presentation (components), state management (hooks), domain logic, and transport (API), making features self-contained and testable. Avoids the pitfall of scattered service files and type definitions. Enforces separation of concerns via ESLint rule banning `fetch` outside `src/api/`.
   - **Trade-off:** More directories, but better maintainability; each feature is independent and can be extended without touching others.
   - **Alternatives:** Flat structure by type (components, services, utils) — proven to couple unrelated files; shared/core layer — adds an extra level without clarity.
   - **See:** `docs/adr/0002-struttura-per-feature.md`.

2. **Stream state with `useReducer`, per-frame batching, and send disabled during a stream** (P1-03, T016):
   - **Decision:** `useChatStream` uses `useReducer` with the pure `chatStreamReducer` (`src/features/chat/lib/chatStreamReducer.ts`; actions `start`, `delta`, `citations`, `error`, `abort`, `done`, `reset`). `content` deltas are buffered and flushed with `requestAnimationFrame` (fallback `setTimeout` 16 ms) in `src/features/chat/hooks/useChatStream.ts`; `ChatMessageItem` is wrapped in `React.memo`. The stream is aborted on Stop, on unmount and on chat switch/new chat; the partial message stays with status `aborted`.
   - **Send during a stream:** disabled. The composer is disabled and shows "Interrompi" instead of "Invia"; "Riprova" is hidden while streaming. The rule is enforced in the reducer, the hook and the UI.
   - **Tests:** 500 chunks delivered in one tick cause 1 render of the message component (limit 5); negative control without batching: 61 renders (`tests/integration/ChatWorkspace.batching.test.tsx`). Reducer, abort and disabled-send are covered by `tests/unit/chatStreamReducer.test.ts` and `tests/integration/ChatWorkspace.abort.test.tsx`.
   - **See:** `docs/adr/0003-invio-durante-stream.md`.

3. **Same-origin proxy with `next.config.ts` `rewrites`** (P0-03):
   - **Decision:** Use Next.js rewrites to proxy `/api/*` → `${BACKEND_URL}/api/*`.
   - **Rationale:** Starlette 0.50.0 (unpinned) returns `Access-Control-Allow-Origin: *` with credentials, which browsers reject. A same-origin proxy sidesteps CORS by making all requests appear to come from the same origin (`localhost:3000`).
   - **Trade-off:** Backend URL is fixed at build time; runtime switching requires a rebuild. Docker build arg (P0-07) enables passing `BACKEND_URL` at image build time.
   - **Alternatives:** CORS middleware on backend (out of scope), explicit route handler proxy (more verbose), static export (incompatible with rewrites).
   - **See:** `docs/adr/0001-proxy-same-origin.md`.

4. **`rehype-sanitize` for XSS protection** (P0-04):
   - **Decision:** Sanitize Markdown rendering with `rehype-sanitize` after `rehype-raw` (not before, not with DOMPurify).
   - **Rationale:** Pipeline-native, doesn't require additional libraries, works on the AST before DOM insertion.
   - **Trade-off:** default schema only; no custom allowlist.

5. **`react-pdf` canvas rendering** (P1-08):
   - Native `<iframe>`/`<embed>` lack programmatic DOM overlay access. `react-pdf` (^11, su `pdfjs-dist`) renders pages to canvas, enabling pixel-accurate overlays; the worker is served locally (`lib/pdfWorker.ts`).

6. **Streaming error handling and normalized ApiError** (P0-05, P1-01):
   - **Decision:** Distinguish stream errors (`type: "error"`), malformed lines (`NDJSONParseError`), HTTP errors (`ApiError.status` valued), and network errors (`ApiError.status` null, `code: 'network'`). All errors are normalized to `ApiError { status, code, userMessage, cause, detail }`.
   - **Rationale:** Users see a friendly Italian message (`userMessage`); technical details (status, response body, stack) go to `console.error(error.cause)` only. A `code` enum enables reliable error handling: `if (error.code === 'aborted')` skips showing the error message, for example.
   - **Trade-off:** Extra error normalization layer; rewarded by consistent, testable error handling across network, stream, and parse failures.

7. **Explicit UX States**:
   Chat messages carry the states `idle`, `streaming`, `completed`, `error` and `aborted` (types in `src/features/chat/types.ts`).

---

## 7. Known Limitations

- **Backend assumptions and design:**
  - **Documents are global** (not per-user): all authenticated users see the same document library (`BE:src/routes/documents.py:120`, `docs/AUDIT.md` Assumption 10). Each user can upload their own documents, but the upload list shows all documents.
  - **`page_count` is a mock**: all documents report exactly 5 pages, regardless of the actual PDF page count (`BE:src/dependencies.py:25`).
  - **`text_quote` is a placeholder**: citations always include the same hardcoded phrase (`BE:src/routes/chat.py:194`), not a real excerpt from the document. This is by design for the test; highlighting specific text in the PDF is therefore not meaningful.
  - **Each chat = one Q/A pair**: the backend creates a new chat record on every `POST /api/chat/` request. The frontend can send a `history` field, but the backend ignores it (not persisted). Multi-turn conversation is managed locally only.
  - **Response types are not in OpenAPI**: all `GET` and `POST` endpoints return `200` with an empty schema `{"schema": {}}` in `docs/api/openapi.json` (generated from the backend source without running it). Real response types are documented in `docs/AUDIT.md` §2 and written by hand in `src/api/types.ts` (`Document` line 47, `UploadResponse` line 58, `ChatRecord` line 66). Request types (`LoginRequest`, `ChatRequest`) derive from `src/api/schema.d.ts`, generated with `npm run gen:api` (`openapi-typescript`). A response that does not match the expected shape (e.g. a non-array list) becomes `ApiError` with code `invalid_response` (`tests/unit/api-contract.test.ts`).

- **Frontend scope (not yet implemented / planned improvements):**
  - PDF text layer (selectable and copyable text) is not implemented.
  - Multi-page continuous scrolling is not implemented; users navigate one page at a time (P1-08).
  - Automatic scroll to the first bounding region when opening a citation is not implemented (P1-08).

- **Minor issues (low severity):**
  - `/favicon.ico` returns 404 (no favicon in the project).
  - Requests to `/api/...` without trailing slash (e.g., `/api/documents` instead of `/api/documents/`) receive a 307 redirect with an absolute backend URL (`http://backend:8000/...`), which is unreachable from the browser. The application always uses the trailing slash, so this does not affect normal operation.

- **Validation details:**
  - Client `user_id` validation is more restrictive than the backend: only ASCII `[a-zA-Z0-9_-]` (max 100 chars), vs backend `str.isalnum()` which accepts Unicode. The backend is lenient; the client enforces stricter rules.

- **Full-list loading:**
  - The client downloads every page of chats and documents (`src/api/pagination.ts`). With very long histories this should be replaced by incremental pagination (P2-04).

- **Testing note:**
  - E2E tests (Playwright) require a running backend instance. Unit and integration tests (Vitest + MSW) do not.

---

## 8. With More Time

This section tracks planned improvements aligned with the evaluation criteria and UX enhancements (items from `docs/ROADMAP.md`):

**Feature structure and API layer (P1-01):** Done (T012) — refactored into feature-based directories (`src/features/{auth,documents,chat,factcheck,history}/`) with dedicated hooks and typed API client (`src/api/`). `ChatWorkspace.tsx` reduced from 559 to 133 lines; stream logic moved to `useChatStream` hook. All HTTP requests normalized to `ApiError`. ESLint forbids `fetch` outside `src/api/`. See ADR 0002.

**API types from OpenAPI (P1-02):** Generate request types from `docs/api/openapi.json` with `openapi-typescript`; write response types by hand (OpenAPI lacks them). Add validation and remove speculative field normalization.

**User-friendly error messages (P1-04):** Map backend error codes and network errors to Italian messages without exposing technical details (no status codes, no URLs, no stack traces).

**Session and 401 handling (P1-05):** Done (T018) — redirect to login on any 401 and `localStorage` read after mount (see Cookie Authentication).

**Chat history model (P1-07):** Done (T019) — one chat = one Q/A pair, new questions never modify a selected entry. See ADR 0004.

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
