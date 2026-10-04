# DocFact Chat & Citations — Frontend Technical Test

Production-ready Frontend application built with **React 19**, **Next.js 15 (App Router)**, and **TypeScript** for the Frontend Software Engineer Technical Test.

The application implements a document-grounded chatbot interface consuming a backend REST API with **NDJSON streaming**, real-time Markdown/HTML progressive rendering, actionable citations, and a **high-fidelity PDF Fact-Checking Viewer** with normalized bounding box overlays.

---

## 1. Prerequisites & Installation

### Prerequisites
- **Node.js**: v18.17+ or v20+
- **Package manager**: npm, yarn, or pnpm
- **Running Backend**: FastAPI backend instance (defaults to `http://localhost:8000`)

### Installation
```bash
# Clone the repository
git clone <repo-url>
cd <repo-folder>

# Install dependencies
npm install
```

### Running the Frontend
```bash
# Start development server on port 3000
npm run dev

# Or build and start for production
npm run build
npm run start
```
The application will be accessible at: `http://localhost:3000`.

---

## 2. Backend Configuration & API Boundaries

### Configurable API Base URL
- **Default Base URL**: `http://localhost:8000`
- Configurable via the environment variable in `.env.local` or `.env`:
  ```env
  NEXT_PUBLIC_API_URL="http://localhost:8000"
  ```
- **Runtime Developer Switcher**:
  The application includes an in-app **Backend API Settings Modal** (accessible via the gear icon in the sidebar or from the login screen). You can point the app to another port (e.g. `http://localhost:8080`), a tunneling URL (ngrok / Cloudflare Tunnel), or a remote staging server without modifying code or restarting the app. The modal provides a live **"Verifica" (Test Connection)** tool that tests endpoint reachability, returns HTTP response latency, and gives instant diagnostics in case of CORS or connection refusal.

### Cookie Authentication Handling
The backend mock authentication sets a `user_id` cookie on `POST /api/auth/login`.
In compliance with the backend contract:
- The frontend **does not invent, store, or simulate tokens**.
- All network requests in `services/api-client.ts` specify `credentials: 'include'`.
- The browser natively manages and sends the session cookie on subsequent calls (`/api/documents/`, `/api/chat/`, etc.).
- When testing across different origins (e.g. `localhost:3000` to `localhost:8000`), ensure the FastAPI backend includes `CORSMiddleware` with `allow_credentials=True` and specifies the frontend origin.

---

## 3. Architecture & Project Structure

The project strictly decouples presentation components, business logic, domain models, and API transport:

```
├── config/
│   └── api.ts                   # Centralized API base URL config & dynamic override
├── types/
│   ├── api.ts                   # Generic async state, errors, network types
│   ├── auth.ts                  # Auth models and login payloads
│   ├── document.ts              # Document and upload domain models
│   ├── citation.ts              # Citations, RectInches, BoundingRegion types
│   └── chat.ts                  # ChatMessage, ChatSummary, StreamChunk contracts
├── services/
│   ├── api-client.ts            # Central fetch wrapper (credentials, errors, status normalization)
│   ├── auth-service.ts          # Login validation (alphanumeric, -, _), cookie setup
│   ├── document-service.ts      # List documents, multipart upload (files field), blob retrieval
│   └── chat-service.ts          # Chat history, chat details, NDJSON stream consumer
├── utils/
│   ├── ndjson.ts                # Robust NDJSON chunk buffer parser
│   ├── coordinates.ts           # Inch-to-percentage and pixel coordinate math (72 DPI)
│   └── sanitize.ts              # DOMPurify sanitizer for Markdown and allowed inline HTML
└── components/
    ├── auth/
    │   └── LoginForm.tsx        # User login, client validation, presets, diagnostics
    ├── documents/
    │   ├── DocumentListModal.tsx     # Document library, status, direct viewer trigger
    │   └── DocumentUploadDropzone.tsx # Multipart PDF uploader with drag-and-drop
    ├── chat/
    │   ├── ChatWorkspace.tsx    # Primary workspace orchestration
    │   ├── ChatSidebar.tsx      # Chat history, new chat, doc library shortcut, user info
    │   ├── ChatComposer.tsx     # Auto-resizing query input with stream abort support
    │   ├── ChatMessageItem.tsx  # Message renderer (user, streaming, error, retry, citations)
    │   ├── MarkdownRenderer.tsx # React-markdown + remark-gfm + sanitized HTML tables/code
    │   └── RelatedDocumentsSection.tsx # Actionable citation cards
    ├── pdf/
    │   ├── PdfFactCheckViewer.tsx    # PDF fact-checking viewer with canvas & navigation
    │   └── BoundingBoxOverlay.tsx    # Responsive percentage-based bounding box highlights
    └── settings/
        └── BackendConfigModal.tsx    # Runtime API switcher & connectivity diagnostics
```

---

## 4. Key Implementation Details

### How NDJSON Streaming is Handled
Network chunks received over `ReadableStream<Uint8Array>` do **not** reliably match line boundaries: a single chunk can split a multi-byte UTF-8 character, cut a JSON string in half, or contain multiple lines.

In `utils/ndjson.ts`:
1. We feed bytes through `TextDecoder({ stream: true })`.
2. Accumulate incoming text in a persistent string `buffer`.
3. Split on newlines `/\r?\n/`.
4. Keep the trailing incomplete piece in the buffer until the next network packet arrives.
5. Parse complete lines with `JSON.parse` wrapped in defensive `try/catch`.
6. Supported event types:
   - `{"type": "content", "delta": "<string>"}`: Appends incrementally to current assistant message state without re-rendering or replacing the entire conversation tree.
   - `{"type": "citations", "references": [...]}`: Final chunk attaching verified document citations.
   - `{"type": "error", "error": "<string>"}`: Surfaces defensive, understandable error banner.
7. Support for `AbortController`: Clicking "Interrompi" halts the stream immediately, releases the stream reader lock, and preserves the partial answer generated up to that moment with a "Riprova" (Retry) action.

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
Assistant responses may contain Markdown (lists, blockquotes, code blocks) and HTML elements (tables, `<strong>`, `<ul>`).
- In `utils/sanitize.ts`, `DOMPurify` filters content against an explicit whitelist of safe tags and attributes, blocking script execution, `javascript:` pseudo-protocols, and malicious inline event handlers (`onerror`, `onload`).
- In `components/chat/MarkdownRenderer.tsx`, tables are wrapped in a horizontally scrolling container with clean borders and striped rows to maintain usability on mobile devices.

### Chat History Consistency
Both active live chat sessions and previously stored sessions loaded from `GET /api/chat/{chat_id}` pass through the exact same `ChatMessageItem` and `MarkdownRenderer` components. This guarantees 100% visual and functional consistency across new and historical conversations.

---

## 5. Architectural Decisions & Trade-Offs

1. **Direct `pdfjs-dist` Canvas Rendering vs `<iframe>` / `<embed>`**:
   Native browser PDF embeds lack programmatic DOM overlay access, preventing bounding box visualization. By utilizing `pdfjs-dist` to render pages onto an HTML5 `<canvas>`, we achieve pixel-accurate rendering, multi-scale zooming, and seamless DOM coordinate overlays.
2. **Dynamic Import for `pdfjs-dist`**:
   PDF.js relies on browser globals (`window`, `HTMLCanvasElement`). Loading it dynamically inside `useEffect` prevents SSR hydration mismatches and Next.js server-side build failures.
3. **Local React State vs Global State Store (Redux / Zustand)**:
   Given the scope and clear lifecycle boundaries (auth -> workspace -> viewer), React's native state combined with modular services avoids unnecessary boilerplate while keeping state predictable and collocated.
4. **Explicit UX States**:
   Every asynchronous flow explicitly handles `idle`, `loading`, `streaming`, `success`, `error`, and `aborted` states. Users are never left with silent failures or frozen spinners.

---

## 6. Known Limitations & Potential Enhancements

- **PDF Text Layer**: The viewer currently renders visual highlights and canvas pixels. Adding a selectable text layer (`pdfjs-dist` text content layer) would allow users to select and copy text directly from the PDF canvas.
- **Multi-page continuous scroll**: The viewer currently features single-page navigation (`<` Prev, `>` Next, jump to page). A virtualized infinite vertical scroll for multi-page documents could be added with more time.
- **Offline / Mock Mode Toggle**: A dedicated offline mock fixture mode could be toggled for automated visual regression testing when no backend instance is available.

## 7. Sviluppo con Claude Code (team di subagenti)

Il lavoro sul frontend è orchestrato con Claude Code: `CLAUDE.md` (regole dell'orchestratore), `.claude/agents/` (subagenti), `.claude/hooks/` (guard, quality gate, validazione output) e `docs/ROADMAP.md` (piano).

Limiti noti degli hook:
- `.claude/hooks/guard-orchestrator.mjs` impedisce al thread principale di modificare file fuori da `.claude/` e `CLAUDE.md`. Il controllo sui comandi **Bash** è **best-effort**: riconosce i pattern di scrittura comuni (`sed -i`, `perl -i`, `tee`, redirezioni `>`/`>>`, `cp`, `mv`, `rm`, `git apply`, `git checkout --`, `--write`, `--fix`, `npm install`), ma non ogni possibile scrittura via shell (ad esempio script eseguiti con `node -e` o `python -c`).
- Il quality gate (`.claude/hooks/quality-gate.mjs`) esegue `typecheck`, `lint` e `test`, non gli e2e, che richiedono il backend avviato.
