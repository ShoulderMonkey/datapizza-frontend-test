# Changelog

Tutti i cambiamenti rilevanti sono documentati in questo file.

Formato: [Keep a Changelog](https://keepachangelog.com/it/1.1.0/).

---

## [Unreleased]

### Added (T016, P1-03)
- `src/features/chat/lib/chatStreamReducer.ts`: reducer puro con azioni tipizzate (`start`, `delta`, `citations`, `error`, `abort`, `done`, `reset`).
- ADR 0003 (`docs/adr/0003-invio-durante-stream.md`): invio disabilitato durante lo stream.
- Test: `tests/unit/chatStreamReducer.test.ts`, `tests/integration/ChatWorkspace.batching.test.tsx` (500 chunk in un tick: 1 render, limite 5; controllo negativo 61 render), `tests/integration/ChatWorkspace.abort.test.tsx` (Stop, unmount, cambio chat, invio disabilitato).

### Changed (T016, P1-03)
- `useChatStream` usa `useReducer` e applica i `delta` con batching `requestAnimationFrame` (fallback `setTimeout` 16 ms).
- `ChatMessageItem` avvolto in `React.memo`.
- Composer disabilitato durante lo stream e durante il caricamento di una chat; "Riprova" nascosto durante lo stream.
- Lo stream viene abortito anche al cambio di chat (oltre a Stop e unmount); il messaggio parziale resta `aborted`.

### Added (T001)
- Harness di test: Vitest con ambiente jsdom, `@testing-library/react`, `@testing-library/jest-dom`, MSW per streaming NDJSON.
- `playwright.config.ts` con `baseURL: http://localhost:3000` e `webServer` (`npm run dev`).
- Script npm: `typecheck`, `lint`, `test`, `e2e`.
- Test unit su `utils/ndjson.ts`: riga spezzata tra chunk produce un solo oggetto.

### Changed (T002)
- ESLint: consolidamento in un'unica configurazione flat (`eslint.config.mjs`); `.eslintrc.json` rimosso.
- Allineamento di `eslint-config-next` alla major di `next` (15.5.27).
- `next.config.ts`: rimosso `eslint.ignoreDuringBuilds`.

### Added (T003)
- Pipeline di rendering sicuro: `react-markdown` + `remark-gfm` + `rehype-raw` + `rehype-sanitize`.
- Test unit di regressione per Markdown con HTML inline (tabelle GFM, strong, liste, blockquote).
- Test di sicurezza XSS: script tag, onerror handler, javascript: URL rimossi.

### Changed (T003)
- Rimozione di DOMPurify e `utils/sanitize.ts` (sostituiti da `rehype-sanitize`).

### Fixed (T004)
- Validazione `user_id`: lunghezza massima portata da 64 a 100 (allineata al backend `BE:src/routes/auth.py:15`).
- Caratteri consentiti: solo ASCII `[a-zA-Z0-9_-]` (differenza dal backend che usa `str.isalnum()` con Unicode).
- Test unit: validazione vuoto, lunghezza, charset.
- Test integration: 422 dal backend mostra messaggio italiano, non il `msg` Pydantic.

### Fixed (T005)
- Errori durante lo streaming: chunk `{"type": "error", "message": "..."}` lascia il messaggio in stato `error` (non sovrascritto da `completed`).
- Righe malformate (JSON non valido): `utils/ndjson.ts` lancia `NDJSONParseError`; il messaggio passa a `error` con testo italiano e il testo parziale resta visibile.
- Chunk con `type` sconosciuto: ignorati (`console.debug` fuori produzione), stream prosegue.
- Risposta HTTP 400/401/500 prima dello stream: distinta dall'errore di rete (`ApiClientError.statusCode` valorizzato, `isNetworkError: false`).

### Removed (T006)
- Dipendenze: `@google/genai`, `motion`, `firebase-tools`, `@hookform/resolvers`, `@types/dompurify`, `dompurify`, `clsx`, `tailwind-merge`, `class-variance-authority`.
- File: `metadata.json`, `hooks/use-mobile.ts`, `lib/utils.ts`.
- Configurazione: `images.remotePatterns` (picsum), `transpilePackages: ['motion']`, blocco `DISABLE_HMR` in `next.config.ts`.
- `.env.example` contiene ora solo `BACKEND_URL`.

### Added (T007)
- Proxy same-origin `/api/*` → `${BACKEND_URL}/api/*` via `next.config.ts` rewrites.
- Doppia regola di rewrite (con e senza trailing slash) per preservare la slash da FastAPI.
- Client API con URL relativi (`/api/...`), `credentials: 'same-origin'` (`services/api-client.ts`).
- `skipTrailingSlashRedirect: true` in `next.config.ts`.
- Test unit: verifica che ogni `fetch` riceva URL relativo (nessun `localhost:8000` nel client).
- E2E (`e2e/proxy-cookie.spec.ts`, `e2e/proxy-streaming.spec.ts`, `e2e/smoke.spec.ts`): cookie forwarding e streaming NDJSON non bufferizzato; `npm run e2e` exit 0 (3 passed) contro il backend reale, report in `.claude/reports/T007/`.
- ADR `docs/adr/0001-proxy-same-origin.md`: motivazione, implementazione, alternative scartate, impatto Docker.

### Removed (T007)
- `config/api.ts` (override runtime del backend URL).
- `components/settings/BackendConfigModal.tsx` (modal di configurazione del backend).
- Ogni `fetch()` nei componenti (grep: 0).

### Added (T010)
- `Dockerfile`: Multi-stage build (deps, builder, runner) on `node:22-alpine`; `npm ci` in deps stage, `next build` with `output: 'standalone'` in builder, non-root user `nextjs` (uid 1001, gid 1001) in runner. `ARG BACKEND_URL=http://backend:8000` set in builder stage before `npm run build` (rewrites evaluated at build time). `EXPOSE 3000`, `CMD ["node", "server.js"]`.
- `.dockerignore`: Excludes `node_modules`, `.next`, `.git`, `.claude`, tests, e2e, `docs`, `.env*` (except `.env.example`), `.tsbuildinfo`, and Dockerfile/Compose files themselves.
- `docker-compose.yml`: Services `backend` (builds from `../test-tecnico-frontend-engineer/backend`, Python health check, port 8000 internal only) and `frontend` (builds with `BACKEND_URL` build arg, port 3000:3000, depends_on backend healthy). Backend data volume mounted read-only.

### Changed (T010)
- `package-lock.json`: Regenerated with `npm install --package-lock-only --ignore-scripts` inside `node:22-alpine` to fix missing optional peer deps (`@emnapi/*`) required by `npm ci` on Linux. No version changes, only new entries for Linux-specific optional dependencies and peer flag adjustments.

### Changed (T011)
- `README.md`: Prerequisiti Node corretti: versioni pinned da `jsdom`, `vitest`, `@playwright/test` in `package-lock.json`. Layout cartelle separato in "Project Layout" per chiareza su backend e frontend distinti.
- `README.md` (P0-08): Aggiunta nota su `output: 'standalone'` (`next.config.ts:11`) e avviso di `npm start`; avvio raccomandato in produzione è il `Dockerfile`.
- `README.md` (P0-08): Aggiunta limitazione: `POST /api/chat/` invia `chat_id` nel body ma lo schema OpenAPI non lo documenta (P1-02).
- `README.md` (P0-08): Rimossa frase inesatta su canvas percentuali; overlay usa CSS percentuali, canvas usa pixel da pdfjs-dist.
- `README.md` (P0-08): Ripristinato testo italiano di "Sviluppo con Claude Code (team di subagenti)" con spiegazione dei quattro subagenti e limiti best-effort degli hook.
- `README.md` (P0-08): Riformulata P1-03 secondo criterio roadmap: "500 chunk `content` in un tick → massimo 5 render del componente".

### Added (T011)
- Verifica su clone pulito: comandi `npm ci`, `npm run dev`, `docker compose up --build` eseguiti da `frontend-tester` (nodo v25.2.1) con evidenza in `.claude/reports/T011/` (exit code 0, 200 OK su GET / e POST /api/auth/login).

### Added (T012)
- Struttura per feature: `src/features/{auth,documents,chat,factcheck,history}/` con `components/`, `hooks/`, `lib/` (optional) e `types.ts` per feature. Componenti UI generici in `src/components/ui/`.
- Livello API centralizzato: `src/api/{client,errors,ndjson,types,auth,documents,chat,index}.ts` con unico `fetch` in `client.ts:48`.
- Normalizzazione errori: classe `ApiError` con campi `status` (number|null), `code` (enum: network|aborted|bad_request|unauthorized|forbidden|not_found|validation|server|http|invalid_response|stream_parse|client_validation|unknown), `userMessage` (italiano), `cause` (dettaglio tecnico), `detail` (body), `endpoint`. Mappa `DEFAULT_USER_MESSAGES` errori→messaggi italiano.
- Regola ESLint: `no-restricted-globals` (fetch) + `no-restricted-properties` (window/globalThis/self.fetch) fa fallire `npm run lint` se `fetch` compare fuori da `src/api/**`. Deroghe: test, mocks, e2e, config file. Coperto da `tests/unit/eslint-no-fetch.test.ts`.
- Test unit: `tests/unit/api-errors.test.ts` (normalizzazione di rete, 400 stringa, 422 array detail[], abort con delayed e already-aborted), `tests/unit/eslint-no-fetch.test.ts` (regola ESLint su 9 casi).
- ADR `docs/adr/0002-struttura-per-feature.md`: decisione architetturale, contesto, alternative scartate, grafo dipendenze ammesse.

### Changed (T012)
- `src/features/chat/components/ChatWorkspace.tsx`: ridotta da 559 a 133 righe; logica di stream spostata in hook `useChatStream` (183 righe) con stato in `useState`, retry e `AbortController` (abort anche all'unmount); `useReducer` e batching per frame arriveranno con P1-03.
- Errori HTTP, rete, stream NDJSON: tutti convertiti a `ApiError` normalizzato. UI mostra `userMessage` italiano (niente codici HTTP, URL, stack); dettagli tecnici solo in `console.error(error.cause)`.
- Messaggi errore: messaggi italiani per upload fallito, lista fallita, chat fallita, PDF fallito; errore di rete generica; 422 con risposta form validazione; abort non mostrato.
- Retry: rimuove il messaggio fallito dalla conversazione prima di rinviare.

### Fixed (T012)
- Riapertura di chat dallo storico mostra domanda e risposta: `GET /api/chat/{id}` restituisce una coppia `{query, response, citations}` alla radice, ora convertita da `normalizeChatDetail` in due messaggi (user + assistant) con citazioni nel secondo. Evidenza: `src/api/chat.ts:128-139`, test in `tests/unit/chat-get.test.ts`.
- "Riprova" dopo stop non duplica più la domanda utente: il retry sostituisce la bolla utente originale ed esclude domanda e risposta fallita dalla history prima di rinviare. Evidenza: `src/features/chat/hooks/useChatStream.ts`, test in `tests/integration/ChatWorkspace.retry.test.tsx`.

### Removed (T012)
- Directories: `components/`, `services/`, `types/`, `utils/` (consolidati in `src/features/` e `src/api/`).
- Files: `services/api-client.ts`, `services/auth-service.ts`, `services/chat-service.ts`, `services/document-service.ts`, `types/api.ts`, `types/auth.ts`, `types/chat.ts`, `types/citation.ts`, `types/document.ts`, `utils/ndjson.ts`, `utils/coordinates.ts`. Tutti i componenti `components/{auth,documents,chat,pdf}/` e `utils/sanitize.ts` rimossi (già rimosso in T003).

### Added (T013)
- Script `gen:api` (`openapi-typescript docs/api/openapi.json -o src/api/schema.d.ts`), file generato `src/api/schema.d.ts` e devDependency `openapi-typescript` (P1-02).
- `tests/unit/api-contract.test.ts`: il body di `POST /api/chat/` contiene solo `query`/`history`, header `Accept: application/x-ndjson`, `invalid_response` per `listChats`/`getChat`, `listDocuments` come array nudo (P1-02).

### Changed (T013)
- `LoginRequest` e `ChatRequest` derivano da `schema.d.ts`; `Document`, `UploadResponse`, `ChatRecord` riflettono le risposte reali (`docs/AUDIT.md` §2) in `src/api/types.ts` (P1-02).
- Le liste sono array nudi; una risposta non conforme produce `ApiError` con codice `invalid_response`; la richiesta chat invia `Accept: application/x-ndjson` (P1-02).
- `tests/unit/api-client.test.ts`: mock con forme reali.

### Removed (T013)
- Normalizzatori speculativi (`obj.sessions`, `obj.items`, `obj.files`, `obj.chats`), invio di `chat_id` nel body, tipi `ChatSummary`, `DocumentItem`, `DocumentUploadResponse` e index signature `[key: string]: unknown` (P1-02).

### Added (T014)
- Dipendenza `@tanstack/react-query`, `src/components/providers/QueryProvider.tsx` (un `QueryClient` per montaggio, retry max 1 e nessuno su `ApiError` 4xx, `refetchOnWindowFocus: false`) e `src/features/queryKeys.ts` con query key condivise (P1-06).
- Hook `useChatList` (`src/features/history/hooks/useChatList.ts`) e `useChatDetail` (`useChatDetail.ts`, chiave per id con `signal`); `useDocuments` migrato a TanStack Query (P1-06).
- Helper di test `src/test/render.tsx` (`renderWithProviders`), `tests/integration/history-documents-query.test.tsx` (loading `role="status"`, errore con "Riprova", ordinamento, race tra chat A e B, invalidazione dopo upload e a fine stream) e `tests/unit/sortChats.test.ts` (P1-06).

### Changed (T014)
- `ChatSidebar` mostra stati reali: loading (`role="status"`), errore con pulsante "Riprova" (P1-06).
- Il badge dei documenti condivide la stessa query della modale; lo storico e ordinato per `created_at` decrescente; a fine stream la lista chat viene ricaricata (P1-06).

### Removed (T014)
- `page_count` dalla modale documenti (il backend lo valorizza con un mock fisso, `docs/AUDIT.md` §2) e opzione `chatId` di `useChatStream` (P1-06).

### Fixed (T014)
- Badge documenti non aggiornato dopo un upload riuscito: l'upload invalida `queryKeys.documents.all` (P1-06).
- Storico e lista documenti includevano solo i 20 elementi più vecchi (il backend pagina con default 20 in ordine crescente), quindi le chat nuove di un utente con più di 20 chat non comparivano. `fetchAllPages` (`src/api/pagination.ts`: `limit=100`, `offset` crescente, stop alla pagina incompleta, tetto di 50 pagine) è ora usato da `listChats` (`src/api/chat.ts`) e `listDocuments` (`src/api/documents.ts`). Test: `tests/unit/pagination.test.ts`, `tests/integration/chat-list-pagination.test.tsx` (P1-06).

### Added (T015)
- P1-08: `react-pdf` ^11, `src/features/factcheck/lib/pdfWorker.ts` (worker pdf.js locale), componente `PdfPageView`, `lib/regions.ts`, navigazione "Pagine con regioni".
- Test: `tests/unit/coordinates.test.ts`, `tests/unit/regions.test.ts`, `tests/integration/PdfFactCheckViewer.pages.test.tsx`, `e2e/pdf-viewer.spec.ts` (nessuna richiesta CDN, pagina = `bounding_regions[0].page_number`, bbox nel viewport).

### Changed (T015)
- P1-08: `inchesRectToPx` restituisce pixel al posto delle percentuali; scroll alla prima regione; `usePdfDocument` passa il Blob a `react-pdf`.

### Removed (T015)
- P1-08: dipendenza diretta `pdfjs-dist`, worker/cMaps da CDN, selettore di origine, `CoordinateOrigin`, `inchRectToPercent`/`percentToPixels`.

### Fixed (T015)
- `docker build` falliva a `npm ci` perché il lockfile, generato con npm 11.6.2, non era in sync per npm 10 di `node:22-alpine` (mancavano `@emnapi/runtime` e `@emnapi/core`). Il deps stage ora esegue `npm install -g npm@11.6.2 && npm ci` (`Dockerfile:7-9`) e `package.json` dichiara `"packageManager": "npm@11.6.2"` (`package.json:5`). Verifica: `docker build` exit 0 e container con risposta 200 (`.claude/reports/T015/docker-build-fixed.txt`).

---

## Note versioning

Lo stato di ciascun item della roadmap (`P0-01`, `P0-02`, ..., `P1-11`) è gestito in `docs/ROADMAP.md` da `documentation-writer`.
