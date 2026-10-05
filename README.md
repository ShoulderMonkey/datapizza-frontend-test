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
npm run start
```

`npm run build` runs `postbuild` (`scripts/copy-standalone-assets.mjs`), which copies `.next/static` and `public` into `.next/standalone`; `npm run start` then runs `node .next/standalone/server.js` (`package.json:9-10`), consistent with `output: 'standalone'` in `next.config.ts`, with no `next start` warning. The `Dockerfile` uses the same standalone output.

The application will be accessible at: `http://localhost:3000`.

### Quality Gate

```bash
# Type checking, linting, and unit/integration tests
npm run typecheck
npm run lint
npm run test

# End-to-end tests (requires running backend)
npm run e2e

# E2E against an already running server (e.g. a production build): no webServer is started
PLAYWRIGHT_BASE_URL=http://localhost:3300 npx playwright test e2e/hygiene.spec.ts
```

**Data left on the backend by e2e (P2-12):** the e2e suite runs against the real backend. Each test logs in with a unique `user_id` per run (`uniqueUser(prefix)` in `e2e/helpers/user.ts`: spec prefix + timestamp + pid + counter + random hex), so runs do not collide. The backend has no delete endpoint (only login, upload, list and get for documents and chats) and keeps its data in an in-memory `MockDatabase` (`BE:src/dependencies.py:8-72`), so chats and uploaded documents created by the tests stay until the backend process is restarted (with `docker-compose`, restart or recreate the container).

```bash
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
│   │   │   ├── components/      # ChatWorkspace (186 lines), ChatComposer, ChatMessageItem, ChatConversation
│   │   │   ├── hooks/           # useChatStream (useReducer + rAF batching), useAutoScroll
│   │   │   ├── lib/             # chatStreamReducer (pure reducer, no React)
│   │   │   └── types.ts         # StreamChunk, ChatMessage domain types
│   │   ├── factcheck/
│   │   │   ├── components/      # FactCheckPanel, PdfFactCheckViewer, PdfPageView, BoundingBoxOverlay, RelatedDocumentsSection, CitationThumbnail, CitationThumbnailPage
│   │   │   ├── hooks/           # usePdfDocument, useDocumentFile, usePdfViewer, useIsDesktop
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
- **Unico `fetch`**: `client.ts:47` contiene l'unica dichiarazione `fetch` nel progetto. Verificato con ESLint `no-restricted-globals`.
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
  { source: '/api/documents', destination: `${BACKEND_URL}/api/documents/` },
  { source: '/api/chat', destination: `${BACKEND_URL}/api/chat/` },
  { source: '/api/:path*/', destination: `${BACKEND_URL}/api/:path*/` },
  { source: '/api/:path*', destination: `${BACKEND_URL}/api/:path*` }
]
```

**Why two rules?** With the sole `:path*` rule the trailing slash is dropped, and FastAPI answers with a 307 redirect to an absolute backend URL (`http://localhost:8000/api/chat/`), which escapes the proxy. The first rule (slash-preserving) must therefore come first. `skipTrailingSlashRedirect: true` (also in `next.config.ts`) stops Next.js from redirecting `/api/chat/` to `/api/chat`, which would break POST requests through the proxy.

**Collection routes without slash (P2-11, T041):** `/api/documents` and `/api/chat` are rewritten straight to the slashed backend URL, before the generic rules. Without this FastAPI answers 307 with an absolute `Location` (`http://backend:8000/...`), which leaks the backend host and is unreachable from the browser. A `redirects()` rule (308) was discarded because it loops: Next matches both forms of the path when `skipTrailingSlashRedirect` is `true`. Method and body are preserved by the proxy. Guarded by `e2e/hygiene.spec.ts`.

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
- **Scroll alla regione**: aprendo una citazione la vista scorre alla prima regione di `bounding_regions[0].page_number`, anche su pagine lontane (scroll continuo, vedi sotto e `PdfPageView.tsx`). Il container del viewer (`PdfFactCheckViewer.tsx:338`) non usa `justify-center`: la pagina è centrata con `mx-auto` sul wrapper (`PdfPageView.tsx:63`), così quando è più larga del pannello il bordo sinistro resta raggiungibile con lo scroll (T035; test `e2e/pdf-viewer-overflow.spec.ts`).
- **Pagine con regioni**: se la citazione ha regioni su più pagine, `PdfFactCheckViewer.tsx` mostra l'elenco "Pagine con regioni" con navigazione (raggruppamento in `lib/regions.ts`).
- **Worker locale**: il worker pdf.js è risolto con `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)` in `src/features/factcheck/lib/pdfWorker.ts`, senza CDN.
- **Layout e focus (P1-09)**: `FactCheckPanel.tsx` mostra il viewer come pannello laterale (`role="complementary"`) a ≥ 1024 px, con la conversazione ancora visibile e scrollabile (`useIsDesktop.ts`), e come dialog a schermo intero (`role="dialog"`, `aria-modal`, pulsante di chiusura) sotto. All'apertura il focus va al pannello; `Escape` lo chiude e il focus torna alla card della citazione. La card attiva (`aria-current` in `RelatedDocumentsSection.tsx`) e le sue regioni sul PDF (`data-active` in `BoundingBoxOverlay.tsx`) sono evidenziate. Test: `tests/integration/FactCheckPanel.test.tsx`, `e2e/layout.spec.ts`.
- **Responsive layout (P1-13)**: sotto 1024 px il drawer applica un fit-to-width automatico alla pagina PDF (`autoFitWidth` in `FactCheckPanel.tsx`, `computeFitScale` con `ResizeObserver` in `PdfFactCheckViewer.tsx`); nel layout affiancato il pannello è `w-[46%] min-w-[320px] max-w-3xl` e la conversazione ha `xl:min-w-[480px]` (`ChatWorkspace.tsx`). Il placeholder del composer è "Fai una domanda..." e le scorciatoie sono nel testo di aiuto collegato con `aria-describedby` (`ChatComposer.tsx`). Test: `e2e/responsive.spec.ts`. A 1024 px con sidebar e viewer aperti le card dei documenti correlati e l'header usano container query (`@container` in `RelatedDocumentsSection.tsx` e `ChatHeader.tsx`) e non si sovrappongono (`e2e/related-1024.spec.ts`).
- **Citation identity per occurrence (P2-08)**: since the backend returns the same placeholder `text_quote` for every citation, structural equality would mark all citations of the same document and page as active together. Each citation therefore gets a client-only `occurrence_key` (`<msgId>:<index>` in `chatStreamReducer.ts`, `<id>-msg-1:<index>` for history in `src/api/chat.ts`; field in `src/api/types.ts`), and `isSameCitation` (`src/features/factcheck/lib/citations.ts`) compares it when present, falling back to the structural comparison. Tests: `tests/unit/citations.test.ts`, `tests/integration/citation-highlight.test.tsx`, `e2e/citation-occurrence.spec.ts`.
- **Continuous scroll and text layer (P2-13)**: the viewer shows all pages in one column with placeholders of exact size (sizes read from the pdf.js worker without drawing, `usePdfPageSizes.ts`); only the pages within one container height above and below the visible area are drawn (`IntersectionObserver`, `RENDER_ROOT_MARGIN` in `PdfPageView.tsx`), the others are released. The current page is the one under the container centre (`findPageAtLine`, `lib/pageLayout.ts`). A citation click scrolls to the region even on a distant page; zoom keeps the centre point. The text layer is enabled (`PdfPageSlot.tsx`, `react-pdf/dist/Page/TextLayer.css`) so text is selectable and copyable; the bounding boxes sit above it with `pointer-events` only on the boxes, and the annotation layer is off. The pdf.js proxy is shared with the thumbnails (`useDocumentProxy.ts`). Tests: `tests/unit/pageLayout.test.ts`, `e2e/pdf-continuous.spec.ts`. See `docs/adr/0008-viewer-scroll-continuo.md`.
- **Graceful Degradation**: If a document binary fails to load, the viewer displays a structured fallback containing the page number, citation text quote, and coordinate metadata.

- **Citation thumbnails (P2-02)**: each citation card shows a 140 px thumbnail of the cited page with only that page's regions (`CitationThumbnail.tsx`, `CitationThumbnailPage.tsx`). It is lazy: nothing is downloaded or parsed until the card is near the viewport (`IntersectionObserver`, `rootMargin` 200 px). The PDF Blob is cached per `document_id` (`useDocumentFile.ts`): one download per document, shared with the viewer (`usePdfDocument.ts`). Tests: `tests/integration/CitationThumbnail.test.tsx`, `e2e/thumbnails.spec.ts`.

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
Una chat del backend è una sola coppia domanda/risposta, quindi ogni voce dello storico ha titolo = `query` e data = `created_at` (con ora), ordinate dalla più recente (`src/features/history/components/ChatSidebar.tsx`); la voce selezionata ha `aria-current`. Selezionare una voce mostra domanda, risposta e "Documenti correlati" con le citazioni salvate. Una nuova domanda (o Riprova) con una voce selezionata avvia una nuova sessione locale: la selezione viene annullata, la voce non cambia e a fine stream compare una nuova voce in cima. Quando il salvataggio riesce la nuova voce è marcata con `aria-current` (senza essere selezionata, quindi la conversazione locale resta; `useSavedChat.ts`, `findSavedChatId.ts`) e un annuncio `role="status"` dice "Conversazione salvata nello storico" (`HistorySavedStatus.tsx`); nessuna marcatura né annuncio su errore di stream o Interrompi. I messaggi della voce precedente restano come contesto in un gruppo etichettato "Dalla conversazione precedente" (`ChatConversation.tsx`). Una nota (`HistoryEntryNotice.tsx`) lo spiega sopra il composer. La conversazione multi-turno esiste solo nel client; `history` viene inviato ma il backend lo ignora. Vedi `docs/adr/0004-modello-storico.md` e `docs/adr/0007-feedback-storico.md` (che modifica il punto 5).

### Server State with TanStack Query
Documenti e storico usano `@tanstack/react-query` (`useDocuments`, `useChatList`, `useChatDetail`). Le query key sono condivise in `src/features/queryKeys.ts`, quindi badge e modale dei documenti leggono la stessa cache. Un upload riuscito invalida solo `queryKeys.documents.list()` (`useDocumentUpload.ts`), così i PDF già in cache non vengono riscaricati né riletti. Le thumbnail condividono un solo proxy pdf.js per documento (`useDocumentProxy.ts`, chiave `queryKeys.documents.proxy`) e scalano la pagina nel box 140x180 (`CitationThumbnailPage.tsx`); a fine stream la lista chat viene ricaricata (`onStreamEnd` in `ChatWorkspace.tsx`). Lo storico e ordinato per `created_at` decrescente. La sidebar mostra loading (`role="status"`), errore e pulsante "Riprova". `QueryProvider` (`src/components/providers/QueryProvider.tsx`) crea un `QueryClient` per montaggio con retry massimo 1, nessun retry sugli errori 4xx e `refetchOnWindowFocus: false`. La modale documenti non mostra `page_count`, perche il backend lo restituisce come mock fisso a 5 (limite del backend, `docs/AUDIT.md` §2). Il backend pagina le liste con `limit` 1–100 (default 20) in ordine crescente e senza totale; il client usa una paginazione letterale (`fetchPage` e `nextOffset` in `src/api/pagination.ts`, `useInfiniteQuery`, 20 voci per pagina, pulsante "Carica altre"/"Carica altri"). Vedi `docs/adr/0005-paginazione-letterale.md`.

### Error Handling
Tutti i messaggi mostrati all'utente stanno in una sola mappa in italiano, `ERROR_MESSAGES` (`src/api/errorMessages.ts`). `messageKeyFor` sceglie la chiave dal `code` normalizzato di `ApiError`, dall'endpoint e dal testo `detail` del backend (ad esempio query vuota e troppo lunga su `POST /api/chat/` hanno messaggi distinti). Per l'upload rifiutato con 400 "not recognized", `extractRejectedFilename` estrae il nome del file dal `detail` e il messaggio lo cita. `toUserMessage` (`src/api/errors.ts`) restituisce il messaggio della mappa oppure un fallback per contesto, senza mostrare status code, `detail`, stack o URL del backend (unica cifra ammessa: il limite 100 del `user_id`). I dettagli tecnici restano in `ApiError.cause` e vengono scritti solo in `console` da `logError`. Test: `tests/unit/errorMessages.test.ts`, `tests/integration/error-messages-ui.test.tsx` ed e2e `e2e/upload-errors.spec.ts` (upload di un PDF non ammesso).

**Composer e upload (P1-15):** il composer applica il limite di 10000 caratteri lato client (`QUERY_MAX_LENGTH` in `src/api/chat.ts`, valore del backend `BE:src/routes/chat.py:232`): oltre 9000 mostra il contatore "N/10000 caratteri", oltre il limite mostra un messaggio in italiano (`role="alert"`), disabilita "Invia" e non invia la richiesta (`ChatComposer.tsx`; nessun `maxLength`, così il testo incollato non viene troncato). Dopo un upload riuscito il messaggio di successo resta visibile con `role="status"` anche nel tab lista (`DocumentListModal.tsx`), e durante il caricamento la lista mostra "Caricamento…" invece di "0 file". Test: `tests/integration/p1-15-microcopy.test.tsx`, `tests/unit/no-english-boxes.test.ts`.

---

### Keyboard Accessibility (P1-10)

- **Keyboard path:** login, open the documents modal, upload (the dropzone is `role="button"`, Enter/Space open the file picker: `DocumentUploadDropzone.tsx`), send a question, open a citation, close the viewer. Covered by `e2e/keyboard.spec.ts`.
- **Language and axe (P2-06):** `<html lang="it">` (`app/layout.tsx`); `e2e/a11y.spec.ts` (`@axe-core/playwright`) checks 0 serious/critical violations on login, chat and PDF viewer. Run: `npx playwright test e2e/a11y.spec.ts` (requires backend). Timestamps use the `it-IT` format.
- **Dark theme (P2-07):** the theme follows `prefers-color-scheme` (`app/globals.css`, Tailwind `dark:` variants); there is deliberately no manual toggle. The PDF page stays on a white background. `e2e/dark-theme.spec.ts` checks the dark body background and 0 axe `color-contrast` violations, including the upload error and upload in progress states; `tests/unit/dark-hover.test.ts` guards against `dark:hover:*` classes identical to the base `dark:*` class (static class names only). Run: `npx playwright test e2e/dark-theme.spec.ts` (requires backend).
- **Escape and focus:** Escape closes the documents modal (`DocumentListModal.tsx`) and the fact-check viewer (`FactCheckPanel.tsx`); when the viewer closes, focus returns to the citation card.
- **Live region:** the message area is `role="log"` with `aria-live="polite"` and `aria-busy` (`ChatConversation.tsx`).
- **Focus while streaming:** the textarea is `readOnly` + `aria-disabled` (not `disabled`), so focus stays on the input after sending and is not stolen at the end of the stream (`ChatComposer.tsx`, ADR 0003).
- **Skip link and focus after "Interrompi" (P1-12):** the viewer starts with a "Vai alle citazioni" skip link (first tab stop, Enter focuses the first citation card: 2 key presses; `PdfFactCheckViewer.tsx`); after "Interrompi" or a natural end of stream the focus goes to the textarea (`ChatComposer.tsx`). Focus rings: indigo on "Interrompi", amber in the PDF panel. Covered by `tests/integration/focus-p1-12.test.tsx` and `e2e/focus.spec.ts`. Known gap: the "Pagina PDF" region takes 13-14 Tab to reach.
- **Buttons:** suggestion cards, citation cards and bounding boxes are `<button>`; boxes have `tabIndex={-1}` (out of the tab order, the citation list is the keyboard path). The only non-interactive click target is the decorative mobile sidebar backdrop (`aria-hidden`; keyboard alternative: "Chiudi barra laterale").

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
  - Open finding (low severity, T043): at 1280x720 with sidebar and viewer both open, the file name in the viewer header is truncated to one character; it is a side effect of the compact toolbar of T040 and was deferred to avoid reopening the toolbar layout (`docs/ROADMAP.md`, "Findings non trasformati in item").
  - No roadmap item is open.

- **Validation details:**
  - Client `user_id` validation is more restrictive than the backend: only ASCII `[a-zA-Z0-9_-]` (max 100 chars), vs backend `str.isalnum()` which accepts Unicode. The backend is lenient; the client enforces stricter rules.

- **Literal pagination:**
  - The backend lists items in ascending order without a total, so with more than 20 chats the most recent ones may appear only after "Carica altre"; a new chat shows on top only if it falls within the loaded pages; the "+" suffix appears when the total is an exact multiple of 20 (the next page is then empty). See `docs/adr/0005-paginazione-letterale.md`.

- **Upload cancellation:**
  - "Annulla" interrompe la richiesta lato client (`AbortController`, `src/features/documents/hooks/useDocumentUpload.ts`), ma se il backend ha già ricevuto l'intero corpo il file può risultare salvato e comparire al prossimo aggiornamento della lista.

- **Dependency vulnerabilities (P0-09):**
  - An override `next > postcss ^8.5.28` (`package.json:55-59`) brings `npm audit --omit=dev` to 0 vulnerabilities without moving to Next 16. 5 high-severity findings remain in the dev-only chain `eslint-config-next > ... > braces@3.0.3` (no fix published); they affect only ESLint on repository globs, not the production bundle. See `docs/adr/0006-gestione-vulnerabilita-dipendenze.md`.

- **Testing note:**
  - E2E tests (Playwright) require a running backend instance. Unit and integration tests (Vitest + MSW) do not.

---

## 8. With More Time

This section tracks planned improvements aligned with the evaluation criteria and UX enhancements (items from `docs/ROADMAP.md`):

The original P0, P1 and P2 items are done; this section lists only work not yet done, one line per open item of `docs/ROADMAP.md` (no item is open: P0, P1 and P2 are all `done`, including P2-13; see `docs/adr/0006-gestione-vulnerabilita-dipendenze.md` and `docs/adr/0008-viewer-scroll-continuo.md`). The only open point is the low-severity finding on the viewer header file name (see §7), which would need a review of the toolbar layout.

---

## 9. Sviluppo con Claude Code (team di subagenti)

Il lavoro sul frontend è orchestrato con Claude Code: `CLAUDE.md` (regole dell'orchestratore), `.claude/agents/` (subagenti: `frontend-developer`, `frontend-test-writer`, `frontend-tester`, `documentation-writer`), `.claude/hooks/` (guard, quality gate, validazione output) e `docs/ROADMAP.md` (piano).

Limiti noti degli hook:
- `.claude/hooks/guard-orchestrator.mjs` impedisce al thread principale di modificare file fuori da `.claude/` e `CLAUDE.md`. Il controllo sui comandi **Bash** è **best-effort**: riconosce i pattern di scrittura comuni (`sed -i`, `perl -i`, `tee`, redirezioni `>`/`>>`, `cp`, `mv`, `rm`, `git apply`, `git checkout --`, `--write`, `--fix`, `npm install`), ma non ogni possibile scrittura via shell (ad esempio script eseguiti con `node -e` o `python -c`).
- Il quality gate (`.claude/hooks/quality-gate.mjs`) esegue `typecheck`, `lint` e `test`, non gli e2e, che richiedono il backend avviato.
