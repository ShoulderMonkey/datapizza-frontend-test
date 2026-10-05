# Roadmap

> Fonte dei requisiti: `docs/SPEC.md`. Fonte dello stato: `docs/AUDIT.md` (commit `6d18041`).
> Priorità: **P0** = requisito minimo mancante o rotto, rischio XSS, deliverable obbligatorio assente, harness di test assente · **P1** = miglioramento diretto su un criterio di valutazione · **P2** = elemento differenziante coerente con i criteri.
> Lo stato di ogni item è aggiornato **solo** da `documentation-writer`.
> Convenzione per i test: "unit" e "integration" = Vitest + RTL + MSW (`npm run test`); "e2e" = Playwright contro il backend reale (`npm run e2e`).

## Stato attuale (aggiornato a T033)

Gli item originali (P0-01…P0-08, P1-01…P1-11, P2-01…P2-07) sono `done`, come P0-09 (T031), P1-12 (T032) e P1-13 (T033); nessuna riga della tabella è ⚠️. Sono aperti (`todo`) i nuovi item nati dai findings dei task T001–T029: P1-14, P1-15, P2-08, P2-09, P2-10, P2-11, P2-12, P2-13. I findings non trasformati in item sono nella sezione "Findings non trasformati in item (con motivo)".

| Criterio della specifica | Stato | Evidenza | Item |
|---|---|---|---|
| 1. Login mock + cookie | ✅ | `src/api/client.ts` (proxy same-origin, credentials: 'same-origin'); `e2e/proxy-cookie.spec.ts` | P0-03 |
| 1. Validazione `user_id` (vuoto / caratteri / lunghezza) | ✅ | `src/api/auth.ts` (USER_ID_MAX_LENGTH = 100); `tests/unit/auth-service.test.ts`; `tests/integration/LoginForm.test.tsx` | P0-06 |
| 2. Upload multiplo, stato, errori | ✅ | `src/features/documents/components/DocumentUploadDropzone.tsx`; `src/api/errorMessages.ts`; `e2e/upload-errors.spec.ts`; annullamento con "Annulla" (`useDocumentUpload.ts`, `tests/integration/document-upload-cancel.test.tsx`) | P1-04, P2-05 |
| 2. Lista documenti | ✅ | `src/features/documents/hooks/useDocuments.ts`; `tests/integration/history-documents-query.test.tsx`; paginazione letterale a 20 con "Carica altri" (`src/api/pagination.ts`, ADR `docs/adr/0005-paginazione-letterale.md`) | P1-06, P2-04 |
| 3. Layout chat + Invia | ✅ | `src/features/chat/components/ChatWorkspace.tsx`, `ChatComposer.tsx` | P1-01 |
| 3. Streaming NDJSON incrementale | ✅ | `src/api/ndjson.ts`; `src/features/chat/lib/chatStreamReducer.ts` + batching rAF in `useChatStream.ts`; `tests/integration/ChatWorkspace.batching.test.tsx` | P1-03 |
| 3. Errori di stream (`type:"error"`, righe malformate) | ✅ | `src/api/ndjson.ts` (NDJSONParseError); `tests/integration/ChatWorkspace.stream-errors.test.tsx` | P0-05 |
| 3. Interruzione pulita | ✅ | `src/features/chat/hooks/useChatStream.ts`; `tests/integration/ChatWorkspace.abort.test.tsx` | P1-03 |
| 3. Markdown + HTML inline sicuro | ✅ | `src/components/ui/MarkdownRenderer.tsx` (rehype-raw + rehype-sanitize, nessun dangerouslySetInnerHTML) | P0-04 |
| 4. Documenti correlati (filename, pagina, quote) | ✅ | `src/features/factcheck/components/RelatedDocumentsSection.tsx`; mini-thumbnail lazy con regioni (`CitationThumbnail.tsx`, `CitationThumbnailPage.tsx`) e cache per `document_id` (`useDocumentFile.ts`); `tests/integration/CitationThumbnail.test.tsx`, `e2e/thumbnails.spec.ts` | P2-02 |
| 4. Bounding box sul PDF | ✅ | `src/features/factcheck/components/BoundingBoxOverlay.tsx`; worker locale `src/features/factcheck/lib/pdfWorker.ts`; scroll alla regione in `PdfPageView.tsx`; `e2e/pdf-viewer.spec.ts`, `e2e/layout.spec.ts` | P1-08, P1-09 |
| 5. Storico chat lista + dettaglio | ✅ | `src/features/history/components/ChatSidebar.tsx`; `src/api/chat.ts`; ADR `docs/adr/0004-modello-storico.md`; `e2e/history.spec.ts`; paginazione letterale a 20 con "Carica altre" (ADR `docs/adr/0005-paginazione-letterale.md`) | P1-06, P1-07, P2-04 |
| Qualità: struttura / TS / separazione API-UI | ✅ | struttura per feature (`docs/adr/0002-struttura-per-feature.md`); `ChatWorkspace.tsx` 186 righe (prima 559); tipi richiesta da `src/api/schema.d.ts`; `tests/unit/eslint-no-fetch.test.ts`; BackendConfigModal rimosso da P0-03 (T007) | P1-01, P1-02, P1-11 |
| UX: loading, errori comprensibili, layout | ✅ | `src/api/errorMessages.ts`; viewer affiancato ≥1024 px e dialog sotto (`FactCheckPanel.tsx`, `e2e/layout.spec.ts`); flusso da tastiera (`e2e/keyboard.spec.ts`); limiti aperti dei tester tracciati in P1-13, P1-14, P1-15 (README §8) | P1-04, P1-06, P1-09, P1-10 |
| Uso backend: cookie, metodi, header, body | ✅ | proxy same-origin (P0-03); gestione 401 unica in `src/api/session.ts` (`tests/integration/session-401.test.tsx`, P1-05); body di `POST /api/chat/` con solo `query`/`history` (`tests/unit/api-contract.test.ts`, P1-02); modello storico (P1-07) | P0-03, P1-02, P1-05, P1-07 |
| Deliverable: Dockerfile | ✅ | `Dockerfile` (multi-stage, node:22-alpine, non-root uid 1001), `docker-compose.yml` (backend + frontend, health check), `.claude/reports/T010/03-curl.txt` (docker compose up, curl 200) | P0-07 |
| Deliverable: README accurato | ✅ | README.md §1–9 (sezioni complete), `.claude/reports/T011/summary.md`, `03-dev-curl.txt`, `05-compose-curl.txt` | P0-08 |
| Harness di test / quality gate | ✅ | `package.json` (typecheck, lint, test, e2e); `vitest.config.ts`; `playwright.config.ts`; MSW (`src/mocks/`); vitest 34 file / 250 test (T029); e2e: suite e2e + `e2e/a11y.spec.ts` + `e2e/dark-theme.spec.ts` + `e2e/thumbnails.spec.ts` | P0-01, P0-02 |

---

## P0 — Requisiti minimi e deliverable

### P0-01 — Harness di test e script del quality gate
- Criterio della specifica: "Cosa verrà valutato › Qualità del codice" e "Gestione dello streaming". È il prerequisito tecnico del quality gate (`.claude/hooks/quality-gate.mjs`).
- Owner: `frontend-test-writer`
- Dipendenze: —
- Stima: M
- Ambito file consentito: `package.json` (solo `scripts` e `devDependencies`), `package-lock.json`, rimozione di `bun.lock`, `vitest.config.ts`, `vitest.setup.ts`, `playwright.config.ts`, `tests/**`, `e2e/**`, `src/test/**`, `src/mocks/**`.
- Criteri di accettazione:
  - [x] Package manager npm: esiste `package-lock.json`, `bun.lock` è rimosso e `npm ci` termina con exit 0 da un clone pulito.
  - [x] `package.json` contiene gli script `typecheck` (`tsc --noEmit`), `lint` (`eslint .`), `test` (`vitest run`, non interattivo) ed `e2e` (`playwright test`).
  - [x] Vitest configurato con ambiente `jsdom`, `@testing-library/react`, `@testing-library/jest-dom` e MSW (`msw/node`), con un handler di esempio che restituisce uno stream NDJSON costruito con `ReadableStream`.
  - [x] Esiste almeno un test unit reale su `utils/ndjson.ts`: una riga spezzata tra due chunk produce un solo oggetto. Il test fallisce se si rimuove `buffer = lines.pop()`.
  - [x] `playwright.config.ts` ha `baseURL` `http://localhost:3000` e `webServer` che avvia il frontend. `npm run e2e -- --list` elenca almeno uno smoke test (pagina di login visibile).
  - [x] `npm run test` termina con exit 0. Se `typecheck` o `lint` falliscono per errori nel sorgente esistente, gli errori sono elencati in `issues` con `suggested_owner: "frontend-developer"` (li risolve P0-02).
- Stato: done (T001)

### P0-02 — Baseline verde: typecheck e lint senza errori
- Criterio della specifica: "Qualità del codice › Pulizia, leggibilità, uso di TypeScript". Il quality gate blocca ogni task finché non è verde.
- Owner: `frontend-developer`
- Dipendenze: P0-01
- Stima: S
- Criteri di accettazione:
  - [x] Una sola configurazione ESLint (flat `eslint.config.mjs`); `.eslintrc.json` rimosso; `eslint-config-next` alla stessa major di `next`.
  - [x] `npm run typecheck`, `npm run lint` e `npm run test` terminano con exit 0.
  - [x] Nessuna regola di lint disattivata e nessun `// @ts-ignore` / `eslint-disable` aggiunto (grep sul diff: 0 occorrenze).
  - [x] `next.config.ts` non contiene più `eslint.ignoreDuringBuilds: true`.
- Stato: done (T002)

### P0-03 — Proxy same-origin `/api` per il cookie di sessione
- Criterio della specifica: "Funzionalità minime › 1. Autenticazione mock" e "Utilizzo del backend › autenticazione via cookie". Con Starlette 0.50.0 il login cross-origin con credenziali riceve `ACAO: *` (`docs/AUDIT.md` §2).
- Owner: `frontend-developer`
- Dipendenze: P0-02
- Stima: M
- Criteri di accettazione:
  - [x] `next.config.ts` definisce `rewrites` `/api/:path*` → `${BACKEND_URL}/api/:path*`, con `BACKEND_URL` di default `http://localhost:8000`.
  - [x] Il client chiama solo URL relativi: un test unit sul client API verifica che ogni `fetch` riceva un URL che inizia con `/api/`. Grep `localhost:8000` nei sorgenti: presente solo in `next.config.ts` e nella documentazione.
  - [x] Rimossi l'override runtime dell'URL (`config/api.ts`, `components/settings/BackendConfigModal.tsx`) e ogni `fetch` nei componenti (grep `fetch(` in `components/` e `app/`: 0).
  - [x] e2e (backend reale): login con `test_user` → `context.cookies()` contiene `user_id` per `localhost`, e la successiva `GET /api/documents/` risponde 200.
  - [x] e2e: durante una risposta in streaming attraverso il proxy, il testo del messaggio assistente assume almeno 5 lunghezze diverse prima della fine dello stream (prova che il proxy non bufferizza).
  - [x] ADR `docs/adr/0001-proxy-same-origin.md`: motivazione (CORS + cookie `SameSite=lax`), `next start`/standalone invece di static export (i `rewrites` non funzionano con `output: 'export'`), effetto su Docker.
- Stato: done (T007)

### P0-04 — Rendering Markdown + HTML inline sicuro
- Criterio della specifica: "Funzionalità minime › 3. Rendering delle risposte… HTML inline… gestendo la sicurezza XSS".
- Owner: `frontend-developer` (implementazione), `frontend-test-writer` (test)
- Dipendenze: P0-02
- Stima: S
- Criteri di accettazione:
  - [x] Pipeline `react-markdown` + `remark-gfm` + `rehype-raw` + `rehype-sanitize`, con sanitize dopo raw. Nessun pre-passaggio DOMPurify sul sorgente Markdown e nessun `dangerouslySetInnerHTML` (grep: 0).
  - [x] Test: la risposta mock `BE:src/routes/chat.py:44-47` produce un elemento `<table>` reale con `<strong>Approvato</strong>` (query `getByRole('table')`).
  - [x] Test: `<ul><li><strong>Area</strong></li></ul>` produce `<ul>` e `<strong>`.
  - [x] Test: `<script>alert(1)</script>`, `<img src=x onerror=alert(1)>` e `<a href="javascript:alert(1)">x</a>` non lasciano nel DOM nessun `<script>`, nessun attributo `on*` e nessun `href` che inizi con `javascript:`.
  - [x] Test: `> citazione` produce un `<blockquote>` (regressione del bug `&gt;`), e una tabella GFM produce `<table>`.
- Stato: done (T003)

### P0-05 — Errori durante lo streaming: chunk `error` e righe malformate
- Criterio della specifica: "Gestione dello streaming › Gestione di errori durante lo streaming (chunk di tipo `error`…)".
- Owner: `frontend-developer`
- Dipendenze: P0-02
- Stima: S
- Criteri di accettazione:
  - [x] Test integration (MSW): lo stream `content`×3 → `{"type":"error","message":"Streaming error: x"}` lascia il messaggio in stato `error`, con il testo parziale visibile e un banner con messaggio comprensibile (senza la stringa "Streaming error"). Il test fallisce se la finalizzazione sovrascrive lo stato con `completed`.
  - [x] Test: una riga non JSON nello stream produce uno stato di errore visibile all'utente, senza crash e senza eccezioni non gestite.
  - [x] Test: un chunk con `type` sconosciuto viene ignorato e lo stream prosegue.
  - [x] Test: una risposta HTTP 400/401/500 prima dello stream produce un errore distinto da quello di rete (`ApiError.status` valorizzato).
  - [x] I chunk sono una discriminated union su `type` che include `{ type: "error"; message: string }` (`BE:src/routes/chat.py:209`).
- Stato: done (T005)

### P0-06 — Validazione `user_id` allineata al backend
- Criterio della specifica: "Funzionalità minime › 1. Gestione degli errori di validazione (user_id vuoto, troppo lungo, caratteri non permessi)".
- Owner: `frontend-developer`
- Dipendenze: P0-02
- Stima: S
- Criteri di accettazione:
  - [x] Lunghezza massima **100**, come `BE:src/routes/auth.py:15`, definita come costante unica con commento sulla fonte.
  - [x] Test unit: `""` e `"   "` → errore vuoto; 100 caratteri → valido; 101 → errore di lunghezza; `"a b"`, `"a@b"`, `"àè"` → errore di caratteri; `"user-01_x"` → valido.
  - [x] Test integration: un 422 del backend su `/api/auth/login` mostra un messaggio in italiano, non il `msg` Pydantic.
  - [x] Il README documenta che il client accetta solo ASCII, a differenza di `isalnum()` del backend.
- Stato: done (T004)

### P0-07 — Dockerfile e docker-compose del frontend
- Criterio della specifica: "Deliverable attesi › Dockerfile e (opzionale) docker-compose per il frontend".
- Owner: `frontend-developer`
- Dipendenze: P0-03
- Stima: M
- Criteri di accettazione:
  - [x] `docker build -t docfact-frontend .` termina con exit 0. Build multi-stage `node:22-alpine` con `npm ci` e output `standalone`, eseguito come utente non root. → evidenza: `.claude/reports/T010/01-build.log`, `.claude/reports/T010/01-id.txt` (uid=1001(nextjs))
  - [x] `BACKEND_URL` è passato come build arg o env (i `rewrites` sono valutati a build time) e documentato. → evidenza: `Dockerfile` (ARG + ENV nello stage builder) e sezione README "Running with Docker"
  - [x] `docker-compose.yml` avvia frontend e backend (`build: ../test-tecnico-frontend-engineer/backend`, percorso documentato). Con `docker compose up`, curl su localhost:3000 = 200 e POST /api/auth/login = 200. → evidenza: `.claude/reports/T010/03-curl.txt`, percorso documentato nel README
  - [x] Nessuna risorsa caricata da CDN a runtime (dipende da P1-08 per PDF.js; fino ad allora è un limite dichiarato nel README). → limite dichiarato nel README "Known Limitations"; risolto in P1-08 (T015): worker pdf.js servito localmente, nessuna richiesta CDN (e2e/pdf-viewer.spec.ts)
- Stato: done (T010)

### P0-08 — README accurato con decisioni, trade-off e limiti
- Criterio della specifica: "Deliverable attesi › Un README che spieghi come avviare il frontend… decisioni architetturali, trade-off, limiti, cose che si sarebbero fatte con più tempo".
- Owner: `documentation-writer`
- Dipendenze: P0-03, P0-07 (aggiornato di nuovo a ogni item concluso)
- Stima: S
- Criteri di accettazione:
  - [x] Sezioni presenti: Avvio locale, Avvio con Docker, Architettura, Streaming NDJSON, Rendering PDF e coordinate, Decisioni e trade-off, Limiti noti, Con più tempo farei. → evidenza: README.md titoli §1 (Prerequisites & Installation), §2 (Docker and Backend Configuration), §3 (Architecture & Project Structure), §5 (How NDJSON Streaming is Handled, PDF Rendering & Bounding-Box Coordinate System), §6 (Architectural Decisions & Trade-Offs), §7 (Known Limitations), §8 (With More Time).
  - [x] Ogni affermazione tecnica cita un file esistente. Nessuna frase "Production-ready" e nessuna istruzione di modificare il backend. → evidenza: README.md contiene riferimenti file (grep output, `.claude/reports/T011/04-start.log`); "Production-ready" assente (grep output, exit 0).
  - [x] I limiti del backend sono dichiarati: documenti globali, `page_count` mock, `text_quote` placeholder, una chat = una coppia Q/A, risposte non tipizzate in OpenAPI. → evidenza: README.md §7 "Backend assumptions and design" (righe 305–310).
  - [x] La sezione "Sviluppo con Claude Code", con il limite noto del controllo Bash best-effort di `.claude/hooks/guard-orchestrator.mjs`, è conservata. → evidenza: README.md §9 "Sviluppo con Claude Code (team di subagenti)" (righe 370–377, testo italiano con limite best-effort).
  - [x] I comandi del README (`npm ci`, `npm run dev`, `docker compose up`) sono stati eseguiti da `frontend-tester` su un clone pulito, con evidenza in `.claude/reports/`. → evidenza: `.claude/reports/T011/summary.md`, `03-dev-curl.txt` (npm run dev), `05-compose-curl.txt` (docker compose up).
- Stato: done (T011)

### P0-09 — Vulnerabilità delle dipendenze (npm audit)
- Criterio della specifica: sicurezza (precedenza di `CLAUDE.md` E.8); "Qualità del codice".
- Owner: `frontend-developer`
- Dipendenze: nessuna
- Stima: M
- Fonte: `npm audit` del 2026-10-05; "npm audit non esaminato" aperto in T001, T002, T003.
- Findings: 7 vulnerabilità (6 high, 1 moderate). Runtime/build: `next` (moderate, dipendenza diretta) → `postcss` high (XSS per `</style>` non escapato nello stringify; lettura arbitraria di file `.map` via `sourceMappingURL`); il fix richiede il major `next@16.x`. Solo dev: `eslint-config-next` (diretta) → `@next/eslint-plugin-next` → `fast-glob` → `micromatch` → `braces` high (DoS); il fix proposto da npm è `eslint-config-next@14.2.35` (semver major, incoerente con Next 15).
- Criteri di accettazione:
  - [x] `npm audit --omit=dev` senza vulnerabilità high/critical, oppure ADR in `docs/adr/` che motiva l'accettazione del rischio residuo e la scelta di non passare a Next 16. → evidenza: override `next > postcss ^8.5.28` in `package.json:55-59`; `npm audit --omit=dev` exit 0 ("found 0 vulnerabilities"); `docs/adr/0006-gestione-vulnerabilita-dipendenze.md`.
  - [x] Le vulnerabilità solo-dev sono risolte o elencate nell'ADR. → evidenza: i 5 high solo-dev della catena `braces` (nessun fix disponibile) sono elencati nell'ADR 0006.
  - [x] Quality gate e suite e2e completa con exit 0 dopo l'eventuale aggiornamento. → evidenza: `npm run typecheck`, `npm run lint`, `npm run test` exit 0 (gate dell'orchestratore); e2e 21/21 exit 0 e `npm run build` exit 0 (report del tester T031, non versionato).
- Stato: done (T031)

---

## P1 — Criteri di valutazione

### P1-01 — Struttura per feature e livello API unico
- Criterio della specifica: "Qualità del codice › Struttura del progetto React" e "Separazione tra logica di chiamata API e componenti UI".
- Owner: `frontend-developer` (decisione trasversale: escalation a `opus` secondo CLAUDE.md E.7)
- Dipendenze: P0-02, P0-03
- Stima: L
- Criteri di accettazione:
  - [x] Esistono `src/features/{auth,documents,chat,factcheck,history}/` con `components/`, `hooks/` e `types.ts`, più `src/components/ui/` e `src/api/`. Evidenza: `.claude/state/evidence-T012.json` orchestrator_checks (src/features/* presenti, components/ services/ types/ utils/ rimossi).
  - [x] `src/api/` espone un client tipizzato. Gli errori sono normalizzati in `ApiError { status, code, userMessage, cause }`, con test unit per rete, 4xx con `detail` stringa, 422 con `detail[]` e abort. Evidenza: `.claude/state/evidence-T012.json` (src/api/errors.ts:77, test unit in tests/unit/api-errors.test.ts).
  - [x] Una regola ESLint (`no-restricted-globals` o `no-restricted-syntax` su `fetch`) fa fallire `npm run lint` se `fetch` compare fuori da `src/api/`. Evidenza: `.claude/state/evidence-T012.json` (eslint.config.mjs:24-35, test in tests/unit/eslint-no-fetch.test.ts).
  - [x] `components/chat/ChatWorkspace.tsx` (o il suo successore) non supera 200 righe; la logica di stream vive in un hook. Evidenza: `.claude/state/evidence-T012.json` (src/features/chat/components/ChatWorkspace.tsx:133 righe, useChatStream:183 righe).
  - [x] ADR `docs/adr/0002-struttura-per-feature.md`. Evidenza: file creato (docs/adr/0002-struttura-per-feature.md).
- Stato: done (T012)

### P1-02 — Tipi API da OpenAPI e risposte allineate al backend reale
- Criterio della specifica: "Utilizzo del backend › Capacità di leggere e capire la documentazione in Swagger" e "Uso coerente di HTTP methods, headers, body".
- Owner: `frontend-developer`
- Dipendenze: P1-01
- Stima: M
- Criteri di accettazione:
  - [x] Script `gen:api` (`openapi-typescript docs/api/openapi.json -o src/api/schema.d.ts`); i tipi di request (`LoginRequest`, `ChatRequest`) derivano da `schema.d.ts`.
  - [x] I tipi di risposta sono scritti a mano da `docs/AUDIT.md` §2: `Document`, `UploadResponse`, `ChatRecord {id, user_id, created_at, query, response, citations?}`. Nessuna index signature `[key: string]: unknown`.
  - [x] I normalizzatori speculativi sono rimossi (grep `obj.sessions`, `obj.items`, `obj.files`, `obj.chats`: 0).
  - [x] Test: il body di `POST /api/chat/` contiene solo le chiavi `query` ed eventualmente `history` (niente `chat_id`). L'header `Accept` è `application/x-ndjson`.
- Stato: done (T013)

### P1-03 — Hook di stream con `useReducer` e batching per frame
- Criterio della specifica: "Gestione dello streaming › Aggiornamento incrementale della UI"; "Obiettivo › come vengono gestiti stato, streaming e concorrenza".
- Owner: `frontend-developer`
- Dipendenze: P0-05, P1-01
- Stima: M
- Criteri di accettazione:
  - [x] Hook `useChatStream` con `useReducer` e azioni tipizzate (`start`, `delta`, `citations`, `error`, `abort`, `done`). Test unit del reducer puro per ogni azione. Evidenza: `src/features/chat/lib/chatStreamReducer.ts:69-104` (azioni, più `reset`), `src/features/chat/hooks/useChatStream.ts:51`; `tests/unit/chatStreamReducer.test.ts` (un test per azione).
  - [x] I `delta` sono accumulati e applicati con `requestAnimationFrame`. Test: 500 chunk `content` consegnati in un solo tick producono al massimo 5 render del componente messaggio (contatore di render o React Profiler), e il testo finale è identico alla concatenazione. Evidenza: `tests/integration/ChatWorkspace.batching.test.tsx:33` (caso A: 500 chunk in un blocco → 1 render, limite 5); caso B `:83` (60 chunk su macrotask separati con rAF reale → 5 render, limite 10); controllo negativo `:90` (flush a ogni task → 61 render, asserito > 30). Hook: `useChatStream.ts:23-24`, `:86`.
  - [x] Abort all'unmount, al cambio di chat e su Stop. Test: dopo `abort()` non arrivano più dispatch (nessun warning di update su componente smontato) e il messaggio parziale resta con stato `aborted`. Evidenza: `tests/integration/ChatWorkspace.abort.test.tsx:69` (Stop), `:84` (unmount), `:94` (nuova chat), `:106` (selezione chat); hook `useChatStream.ts:105,113,244`.
  - [x] ADR `docs/adr/0003-invio-durante-stream.md`: un nuovo invio durante uno stream attivo è disabilitato oppure interrompe il precedente. Test che verifica il comportamento scelto. Evidenza: ADR creato (scelta: invio disabilitato); `tests/integration/ChatWorkspace.abort.test.tsx:127`, `tests/unit/chatStreamReducer.test.ts:28`.
- Stato: done (T016)

### P1-04 — Mappa errori → messaggi comprensibili
- Criterio della specifica: "UX › Errori comprensibili per l'utente finale (non solo messaggi tecnici)"; "Funzionalità minime › 2. errori (file non valido, nessun file selezionato…)".
- Owner: `frontend-developer`
- Dipendenze: P1-01
- Stima: S
- Criteri di accettazione:
  - [x] Una sola mappa `codice → messaggio` in italiano per: rete irraggiungibile, 401, 404 chat, 422 login, 400 upload "not recognized" (con il nome del file estratto), 422 upload senza file, 400 query vuota/troppo lunga, chunk `error`, riga malformata, abort. Evidenza: `ERROR_MESSAGES` in `src/api/errorMessages.ts:15`, `messageKeyFor` (`:121`), `extractRejectedFilename` (`:104`); override `errorMessages` rimosso da `client.ts`, `errors.ts`, `index.ts`.
  - [x] Test unit per ogni voce della mappa. Nessun messaggio mostrato contiene uno status code numerico, `detail`, uno stack o l'URL del backend. Evidenza: `tests/unit/errorMessages.test.ts` (test "covers every key" e no-leak su tutti i valori), `tests/unit/api-errors.test.ts`, `tests/integration/error-messages-ui.test.tsx`; `npm run test` exit 0 (25 file, 197 test). Eccezione esplicita: il numero 100 (limite `user_id`) in `login_invalid` e `user_id_too_long`.
  - [x] e2e: upload di un PDF non ammesso → messaggio "«nome.pdf» non è uno dei documenti di test" (o equivalente) visibile, e la lista documenti non cambia. Evidenza: `e2e/upload-errors.spec.ts:9` (`npm run e2e`: 5 passed).
  - [x] Il dettaglio tecnico va solo in `console` (`cause`). Evidenza: `logError` in `src/api/errors.ts:241`; `tests/integration/error-messages-ui.test.tsx` verifica che `console.error` riceva la cause.
- Stato: done (T017)

### P1-05 — Sessione coerente con il cookie e gestione del 401
- Criterio della specifica: "Funzionalità minime › 1. gestione del cookie lato browser"; "Utilizzo del backend › autenticazione via cookie".
- Owner: `frontend-developer`
- Dipendenze: P1-01
- Stima: S
- Criteri di accettazione:
  - [x] Qualsiasi 401 da `src/api/` riporta alla schermata di login con il messaggio "Sessione scaduta, accedi di nuovo" (test integration con MSW).
  - [x] Nessun accesso a `localStorage` durante il render. e2e: la console della pagina non contiene errori di idratazione al reload da loggato.
  - [x] e2e: dopo `context.clearCookies()` e un'azione (apertura documenti), l'utente vede il login, non un errore generico.
  - [x] Logout: lo stato utente e la cache di query vengono svuotati. Il README documenta che il backend non espone un endpoint di logout e che il cookie resta finché non viene sovrascritto.
- Stato: done (T018)

### P1-06 — Server state con TanStack Query: documenti e storico
- Criterio della specifica: "UX › Stati di loading chiari (… caricamento storico)"; "Funzionalità minime › 2. lista documenti" e "› 5. Lista delle chat"; "Qualità › stato globale vs locale".
- Owner: `frontend-developer`
- Dipendenze: P1-01
- Stima: M
- Criteri di accettazione:
  - [x] `useDocuments`, `useChatList` e `useChatDetail` con TanStack Query. Upload riuscito → invalida i documenti; fine stream → invalida lo storico.
  - [x] Test integration: mentre `GET /api/chat/` è pendente (MSW con delay) la sidebar mostra un indicatore di loading accessibile (`role="status"`); in caso di errore, un messaggio e un pulsante "Riprova" che ripete la richiesta.
  - [x] Test: selezione rapida della chat A (risposta lenta) e poi della B (veloce) → viene mostrata B, anche quando A risponde dopo.
  - [x] Storico ordinato per `created_at` decrescente. La lista documenti non mostra `page_count` (mock fisso a 5, `BE:src/dependencies.py:25`).
- Stato: done (T014)

### P1-07 — Modello dello storico coerente con il backend
- Criterio della specifica: "Funzionalità minime › 5. L'integrazione con lo storico deve essere coerente con la UI principale di chat"; "Utilizzo del backend › corretta comprensione degli endpoint".
- Owner: `frontend-developer`
- Dipendenze: P1-02, P1-06
- Stima: M
- Criteri di accettazione:
  - [x] ADR `docs/adr/0004-modello-storico.md`: una chat del backend è una coppia Q/A (`BE:src/dependencies.py:39-57`). La UI la presenta come voce di storico (titolo = `query`, data = `created_at`). La conversazione multi-turno è solo locale e il campo `history` viene inviato senza promettere effetti (il backend lo ignora).
  - [x] e2e: invio di 2 domande → la sidebar mostra 2 nuove voci, la più recente in alto.
  - [x] e2e: selezione di una voce → sono visibili domanda, risposta renderizzata e "Documenti correlati" con le citazioni salvate, e da lì il PDF si apre.
  - [x] Una nuova domanda mentre è selezionata una voce dello storico non modifica quella voce e crea una nuova voce.
- Nota (T012): anticipata la conversione della coppia `{query, response, citations}` di `GET /api/chat/{id}` in due messaggi (user + assistant) tramite `normalizeChatDetail` in `src/api/chat.ts:128-139`. Chiusi in T019: ADR 0004 (`docs/adr/0004-modello-storico.md`), `e2e/history.spec.ts` (3 e2e; `npx playwright test` 9/9 ×2), `tests/integration/history-model.test.tsx`; gate typecheck/lint/test exit 0 (27 file, 210 test).
- Stato: done (T019)

### P1-08 — Viewer PDF affidabile: react-pdf, worker locale, scroll alla regione
- Criterio della specifica: "Funzionalità minime › 4. mostrare visivamente le bounding regions sul PDF"; "UX › Layout efficace per … fact-checking/bounding box".
- Owner: `frontend-developer`
- Dipendenze: P1-01
- Stima: M
- Criteri di accettazione:
  - [x] Rendering con `react-pdf` e worker servito localmente. e2e: nessuna richiesta di rete verso `cdnjs.cloudflare.com` o `cdn.jsdelivr.net` durante l'apertura di un PDF.
  - [x] Funzione pura `inchesRectToPx(rect, pageWidthPt, renderedWidthPx)` (pollici × 72 = pt; pt × renderedWidthPx / pageWidthPt = px). Test unit: `[1,1,2,0.5]` su una pagina di 612 pt renderizzata a 612 px → `{left:72, top:72, width:144, height:36}`; con 1224 px tutti i valori raddoppiano.
  - [x] Il selettore di origine `top-left`/`bottom-left` è rimosso; l'origine è documentata (`BE:tests/bbox_visualization.py:48`).
  - [x] e2e: apertura di una citazione → la pagina mostrata è uguale a `bounding_regions[0].page_number`, ed esiste almeno un elemento `[data-testid="bbox"]` visibile nel viewport (scroll automatico alla prima regione).
  - [x] Una citazione con regioni su più pagine mostra l'elenco delle pagine con regioni e la navigazione tra di esse (test integration con una fixture a 2 pagine).
- Nota (T015): `package.json:25` `react-pdf ^11.0.0`; worker locale in `src/features/factcheck/lib/pdfWorker.ts:5`; `inchesRectToPx` in `coordinates.ts:26` (`tests/unit/coordinates.test.ts`); `data-testid="bbox"` in `BoundingBoxOverlay.tsx:85`; scroll alla regione in `PdfPageView.tsx:50`; navigazione "Pagine con regioni" in `PdfFactCheckViewer.tsx:243` (`tests/integration/PdfFactCheckViewer.pages.test.tsx:31`); e2e `e2e/pdf-viewer.spec.ts` (`npm run e2e` exit 0, 4 passed).
- Stato: done (T015)

### P1-09 — Layout affiancato conversazione + fact-checking
- Criterio della specifica: "UX › Layout efficace per mostrare conversazione, documenti correlati, fact-checking/bounding box".
- Owner: `frontend-developer`
- Dipendenze: P1-08
- Stima: M
- Criteri di accettazione:
  - [x] A viewport ≥ 1024 px il viewer PDF è un pannello laterale e la conversazione resta visibile e scrollabile (e2e: messaggio e PDF entrambi `toBeInViewport()`).
  - [x] A viewport < 1024 px il viewer è un drawer/modal a schermo intero con pulsante di chiusura.
  - [x] All'apertura il focus va al pannello; `Escape` lo chiude e il focus torna alla card della citazione (e2e da tastiera).
  - [x] La citazione attiva è evidenziata sia nella lista della risposta sia sul PDF.
- Stato: done (T020)

### P1-10 — Flusso principale navigabile da tastiera
- Criterio della specifica: "UX e micro-interazioni"; controllo osservabile di `frontend-tester`: "il flusso principale è navigabile da tastiera".
- Owner: `frontend-developer`
- Dipendenze: P1-01
- Stima: S
- Criteri di accettazione:
  - [x] Le card citazione e le card di suggerimento sono `<button>` (grep `<div onClick` in `src/`: 0). Evidenza: `WelcomePanel.tsx:29,43`, `RelatedDocumentsSection.tsx:37,72`, scan in `tests/integration/a11y-keyboard.test.tsx`. Unica eccezione dichiarata: il backdrop decorativo della sidebar mobile (`ChatSidebar.tsx:99-101`, `aria-hidden`, alternativa da tastiera "Chiudi barra laterale" a `:125`), non trovato dal grep letterale perché su più righe.
  - [x] L'area messaggi ha `aria-live="polite"` (`ChatConversation.tsx:43-47`, `role="log"`, `aria-busy`). Dopo l'invio il focus resta sull'input; a fine stream non viene rubato: la textarea è `readOnly` + `aria-disabled` durante lo stream invece di `disabled` (`ChatComposer.tsx:87-90`; ADR 0003 invariato). Test: `tests/integration/ChatWorkspace.abort.test.tsx`, `tests/integration/a11y-keyboard.test.tsx`.
  - [x] e2e da sola tastiera: login → apertura documenti → upload → invio domanda → apertura citazione → chiusura viewer, senza mouse (`e2e/keyboard.spec.ts:31`). `npm run e2e` 14/14 per due esecuzioni consecutive (JSON del test-writer).
- Stato: done (T021)

### P1-11 — Pulizia dei residui AI Studio e delle dipendenze inutilizzate
- Criterio della specifica: "Qualità del codice › Pulizia, leggibilità".
- Owner: `frontend-developer`
- Dipendenze: P0-02
- Stima: S
- Criteri di accettazione:
  - [x] Rimossi da `package.json`: `@google/genai`, `motion`, `firebase-tools`, `@hookform/resolvers`, `@types/dompurify` e `dompurify` (se non più usato dopo P0-04). `npm ls <pkg>` per ciascuno: vuoto.
  - [x] Rimossi `metadata.json`, `images.remotePatterns` picsum, `transpilePackages: ['motion']`, il blocco `DISABLE_HMR`, `hooks/use-mobile.ts` e `lib/utils.ts` se inutilizzati. `.env.example` contiene solo `BACKEND_URL`.
  - [x] `npm run typecheck && npm run lint && npm run test && npm run build`: exit 0.
- Stato: done (T006)

### P1-12 — Focus e navigazione da tastiera: rifinitura
- Criterio della specifica: "UX e micro-interazioni" (accessibilità).
- Owner: `frontend-developer`
- Dipendenze: P1-10
- Stima: S
- Fonte: T021 (report del tester), T027.
- Findings: focus perso sul body dopo "Interrompi" (medium, T021); 15 Tab dal pannello alla lista CITAZIONI, container di scroll focalizzabile (medium, T021); focus ring di "Interrompi" poco visibile (low, T021); focus ring della regione PDF poco visibile (low, T027).
- Criteri di accettazione:
  - [x] Dopo "Interrompi" (click o Enter) `document.activeElement` è la textarea del composer (integration + e2e). Evidenza: `ChatComposer.tsx:49-52` (`handleCancel`) e `:44` (effect a fine stream); `tests/integration/focus-p1-12.test.tsx:60,68,78`; `e2e/focus.spec.ts:36,49,64`. `npm run test` exit 0; `npx playwright test e2e/focus.spec.ts --workers=1` exit 0 (T032).
  - [x] Dall'apertura del pannello la prima card della lista CITAZIONI si raggiunge con al massimo 3 pressioni di tasto: criterio verificato come ≤ 3 pressioni, non come ≤ 3 Tab letterali, perché si è scelto uno skip link "Vai alle citazioni" (primo tab stop del viewer, `PdfFactCheckViewer.tsx:138-140`) invece di riordinare il DOM (WCAG 2.4.3, ordine del focus coerente con l'ordine visivo). Tab + Enter = 2 pressioni. Evidenza: `tests/integration/focus-p1-12.test.tsx:96`; `e2e/focus.spec.ts:83`; tester: `npx playwright test e2e/focus.spec.ts e2e/keyboard.spec.ts --repeat-each=3 --workers=1` exit 0 (15 passed), suite completa `npx playwright test` exit 0 (25 passed).
  - [x] Il focus ring di "Interrompi" e della regione PDF ha contrasto ≥ 3:1 con lo sfondo adiacente in tema chiaro e scuro (WCAG 1.4.11). Evidenza: `ChatComposer.tsx:125` (ring indigo-600 / indigo-400 con offset), `PdfFactCheckViewer.tsx:312` (ring amber-400 inset). Rapporti misurati dal tester (report T032, non versionato): indigo-600 su bianco 6.29:1; indigo-400 su slate-900 5.98:1; amber-400 su slate-950 12.08:1; amber-400 su slate-800 8.76:1 (il pannello PDF è scuro in entrambi i temi).
- Nota (low, tester T032, fuori criterio): la regione "Pagina PDF" è raggiungibile solo con 13-14 Tab dall'ingresso nel pannello; lo skip link porta alla lista citazioni, che è il percorso principale.
- Stato: done (T032)

### P1-13 — Layout responsive di viewer e chat
- Criterio della specifica: "UX e micro-interazioni" (layout).
- Owner: `frontend-developer`
- Dipendenze: P1-09
- Stima: M
- Fonte: T020, T028.
- Findings: PDF tagliato nel drawer mobile a zoom 120% (medium, T020); conversazione stretta a 1440 px con sidebar e viewer aperti, lista citazioni `h-56` (low, T020); placeholder del composer tagliato a viewer aperto (low, T028).
- Criteri di accettazione:
  - [x] A viewport < 1024 px la pagina PDF si adatta alla larghezza del drawer (fit-to-width) e a 390 px e 768 px non c'è scroll orizzontale della pagina (e2e: `scrollWidth <= clientWidth`). Evidenza: `PdfFactCheckViewer.tsx:129-156` (`computeFitScale`, `ResizeObserver`), `FactCheckPanel.tsx:98` (`autoFitWidth={!isDesktop}`), `e2e/responsive.spec.ts:31`. Tester: a 390 px documento 390/390 e canvas 354, a 768 px canvas 716; `npx playwright test` exit 0 (30 passed) e `npx playwright test e2e/responsive.spec.ts --repeat-each=3 --workers=1` exit 0 (15 passed) (T033).
  - [x] A 1440 px con sidebar e viewer aperti la colonna della conversazione è larga almeno 480 px (e2e). Evidenza: `ChatWorkspace.tsx:142` (`xl:min-w-[480px]`), `FactCheckPanel.tsx:85` (`w-[46%] min-w-[320px] max-w-3xl shrink`), `e2e/responsive.spec.ts:81`; main misurata 490 px a 1440 (T033).
  - [x] A viewer aperto il placeholder del composer è interamente visibile (e2e: nessun overflow del testo o placeholder abbreviato). Evidenza: `ChatComposer.tsx:110,115` (placeholder "Fai una domanda..." e `aria-describedby="composer-shortcuts-hint"`: le scorciatoie sono nel testo di aiuto), `e2e/responsive.spec.ts:53`; scrollWidth/clientWidth del placeholder 231/231 a 1024 px e 456/456 a 1440 px (report T033, non versionato).
- Stato: done (T033)

### P1-14 — Feedback dello storico
- Criterio della specifica: "Storico chat" / "UX e micro-interazioni".
- Owner: `frontend-developer`
- Dipendenze: P1-07
- Stima: S
- Fonte: T019.
- Findings: nessun segnale che la nuova voce dello storico è salvata a fine stream (medium, T019); il contesto della voce precedente non ha un'etichetta nella nuova sessione (medium, T019).
- Criteri di accettazione:
  - [ ] A fine stream la nuova voce compare in cima allo storico ed è marcata come attiva (`aria-current`), con un annuncio `role="status"` del salvataggio (integration + e2e).
  - [ ] I messaggi della voce precedente mostrati come contesto hanno un'etichetta visibile e accessibile (es. "Dalla conversazione precedente") (integration).
- Stato: todo

### P1-15 — Microcopy e feedback di upload e composer
- Criterio della specifica: "UX e micro-interazioni" / "Gestione degli errori".
- Owner: `frontend-developer`
- Dipendenze: P1-04, P2-06
- Stima: S
- Fonte: T017, T026, T028.
- Findings: "N boxes" in inglese nella lista CITAZIONI del pannello (`src/features/factcheck/components/PdfFactCheckViewer.tsx:435`) contro "N box verificati" nelle card (low, T028); dopo un upload riuscito la modale passa al tab lista e il messaggio di successo viene smontato (`src/features/documents/components/DocumentListModal.tsx:141-144`; low, T026); la modale mostra "0 file disponibili" durante il caricamento (low, T017); nessun limite client di 10000 caratteri nel composer (il backend rifiuta query troppo lunghe; low, T017).
- Criteri di accettazione:
  - [ ] Nessuna stringa inglese visibile nel pannello citazioni (unit/grep su "boxes" = 0 in `src/`).
  - [ ] Dopo un upload riuscito un messaggio di successo resta visibile (o è annunciato via `role="status"`) anche dopo il passaggio al tab lista (integration).
  - [ ] Durante il caricamento della lista la modale non mostra "0 file" ma uno stato di caricamento (integration).
  - [ ] Il composer impedisce l'invio oltre 10000 caratteri e mostra il contatore o un messaggio in italiano prima della richiesta (integration).
- Stato: todo

---

## P2 — Differenzianti

### P2-01 — Highlight bidirezionale citazione ↔ PDF
- Criterio della specifica: "Obiettivo › come vengono presentate le informazioni di fact-checking (documenti correlati, pagine, highlight)".
- Owner: `frontend-developer`
- Dipendenze: P1-09
- Stima: S
- Criteri di accettazione:
  - [x] Click su un box nel PDF → la card corrispondente riceve `aria-current="true"` e diventa visibile (test integration). Evidenza: `tests/integration/citation-highlight.test.tsx`; `RelatedDocumentsSection.tsx:94` (aria-current), `:30` (scrollIntoView); `npm run test` exit 0 (234 test).
  - [x] Hover o focus sulla card → i box di quella citazione ricevono l'attributo attivo `data-highlighted="true"` (test integration). Evidenza: `tests/integration/citation-highlight.test.tsx`; `RelatedDocumentsSection.tsx:89-92`, `BoundingBoxOverlay.tsx:95`; stato in `useCitationHighlight.tsx` (context locale, nessuna dipendenza nuova).
- Stato: done (T023)

### P2-02 — Mini-thumbnail della pagina con le regioni nella card citazione
- Criterio della specifica: "Funzionalità minime › 4. Visualizzazione (… mini-thumbnail …)"; "Obiettivo › presentazione del fact-checking".
- Owner: `frontend-developer`
- Dipendenze: P1-08
- Stima: M
- Criteri di accettazione:
  - [x] Ogni card mostra una miniatura della pagina citata con i rettangoli disegnati, renderizzata in modo lazy (solo quando visibile, con `IntersectionObserver`). Evidenza: `tests/integration/CitationThumbnail.test.tsx:70` (nessuna GET prima dell'intersezione; poi 1 GET, `data-state` rendered, solo i rect della pagina citata scalati a 140 px); `CitationThumbnail.tsx:46-57` (IntersectionObserver, `rootMargin`, disconnect), `:13` (`next/dynamic` con `ssr: false`), `:78` (`data-state`); `CitationThumbnailPage.tsx:8` (larghezza 140 px).
  - [x] e2e: con 5 citazioni vengono scaricati al massimo N PDF distinti (cache per `document_id`). Evidenza: `e2e/thumbnails.spec.ts:5` (GET `/api/documents/*/file` distinte pari ai `document_id` del chunk citations e totali <= N, anche dopo l'apertura del viewer; `npx playwright test e2e/thumbnails.spec.ts` exit 0, evidence-T029.json); integration `CitationThumbnail.test.tsx:90` (due card dello stesso documento, 1 GET) e `:98` (viewer su documento in cache, nessuna nuova GET); cache in `useDocumentFile.ts:21-22` (`staleTime: Infinity`, `gcTime`), riusata da `usePdfDocument.ts:6,14`; gate T029: typecheck, lint, test exit 0 (34 file / 250 test). Esito della suite e2e completa (T029, frontend-tester): `npx playwright test` exit 0, 21/21; log non versionato (vedi P2-12 e la tabella dei findings non trasformati).
- Stato: done (T029)

### P2-03 — Rendering stabile del Markdown durante lo stream
- Criterio della specifica: "Gestione dello streaming › Aggiornamento incrementale della UI".
- Owner: `frontend-developer`
- Dipendenze: P0-04, P1-03
- Stima: S
- Criteri di accettazione:
  - [x] Test: lo stream carattere per carattere della risposta con `<table>` non mostra mai testo HTML letterale (`&lt;table` o `<tr>` come testo) in nessuno snapshot intermedio campionato. Evidenza: `tests/unit/MarkdownRenderer.streaming.test.tsx:24` (table) e `:28` (ul), tutti i prefissi; fix in `src/components/ui/streamingMarkdown.ts:10` (`stripIncompleteTrailingTag`) applicato in `src/components/ui/MarkdownRenderer.tsx:106`, con `rehypeRaw` + `rehypeSanitize` invariati (`:24`); gate T024: typecheck, lint, test exit 0 (32 file / 236 test).
- Stato: done (T024)

### P2-04 — Paginazione di storico e documenti
- Criterio della specifica: "Utilizzo del backend › Corretta comprensione degli endpoint" (`limit`/`offset`, `BE:src/routes/chat.py:250-251`).
- Owner: `frontend-developer`
- Dipendenze: P1-06
- Stima: S
- Nota (T014): il client scaricava tutte le pagine con limit=100; in T025 `fetchAllPages` è stato sostituito da una paginazione letterale (limit 20, "Carica altre"), vedi `docs/adr/0005-paginazione-letterale.md`.
- Criteri di accettazione:
  - [x] Con 25 chat (MSW) la sidebar mostra 20 voci e un pulsante "Carica altre" che richiede `offset=20` (verifica della query string nel test). Evidenza: `tests/integration/chat-list-pagination.test.tsx:40` (20 di 25, richieste `{20,0}` poi `{20,20}`, 25 voci, pulsante assente), `:68` (nessun pulsante con <20), `:75` (errore pagina successiva), `:104`/`:110` (documenti, badge `20+`, "Carica altri" offset=20); sorgente `src/api/pagination.ts:5` (`PAGE_SIZE = 20`), `:32` (`nextOffset`), `src/features/history/components/ChatSidebar.tsx:172` (suffisso `+`), `:251-258` ("Carica altre"); gate T025: typecheck, lint, test exit 0 (32 file / 244 test).
- Stato: done (T025)

### P2-05 — Annullamento dell'upload in corso
- Criterio della specifica: "UX › Stati di loading chiari (… upload documenti)"; "Obiettivo › concorrenza lato client".
- Owner: `frontend-developer`
- Dipendenze: P1-04
- Stima: S
- Criteri di accettazione:
  - [x] Durante l'upload è visibile il pulsante "Annulla", che chiama `AbortController.abort()`. Test: dopo l'annullamento, nessun messaggio di successo né di errore e lista documenti invariata.
    Evidenza (T026): `tests/integration/document-upload-cancel.test.tsx:57` e `:94` (happy path); `src/features/documents/hooks/useDocumentUpload.ts:17,29,42,55`; `src/features/documents/components/DocumentUploadDropzone.tsx:193-196`; `src/api/documents.ts:18,42`; quality gate typecheck/lint/test exit 0 (33 file / 246 test).
- Stato: done (T026)

### P2-06 — Accessibilità avanzata e lingua
- Criterio della specifica: "UX e micro-interazioni".
- Owner: `frontend-developer`
- Dipendenze: P1-10
- Stima: S
- Criteri di accettazione:
  - [x] `<html lang="it">` (`app/layout.tsx:21`). Evidenza: `grep -n` su `app/layout.tsx:21`; test `e2e/a11y.spec.ts:12` (`html has lang="it"`), rosso prima del fix (lang=en), verde dopo (T027).
  - [x] e2e con `@axe-core/playwright` su login, chat e viewer: 0 violazioni `serious` o `critical`. Evidenza: `e2e/a11y.spec.ts:17` (login), `:24` (chat con citazioni e viewer PDF aperto), helper AxeBuilder a `:51`; prima del fix 2 nodi `color-contrast` su login, 10 su chat, 10 + `label` + `scrollable-region-focusable` sul viewer; dopo il fix `a11y.spec.ts` verde (run del developer, evidence-T027.json). Sorgenti corretti: `PdfFactCheckViewer.tsx:162` (`aria-label="Numero di pagina"`), `:291-293` (`role="region"`, `tabIndex`, `aria-label="Pagina PDF"`), `ChatMessageItem.tsx:63` (`it-IT`), contrasti in `LoginForm.tsx`, `ChatComposer.tsx`, `ChatMessageItem.tsx`, `RelatedDocumentsSection.tsx`, `ChatSidebar.tsx`, `BoundingBoxOverlay.tsx`. Esito della suite e2e completa (tester, ciclo 1, T027): exit 0, 17 passed.
- Stato: done (T027)

### P2-07 — Tema scuro
- Criterio della specifica: "UX e micro-interazioni" (layout e leggibilità).
- Owner: `frontend-developer`
- Dipendenze: P1-09
- Stima: S
- Criteri di accettazione:
  - [x] Con `colorScheme: 'dark'` in Playwright, lo sfondo di `body` è scuro e il contrasto testo/sfondo dei messaggi è ≥ 4.5:1 (axe `color-contrast`: 0 violazioni). Evidenza: `e2e/dark-theme.spec.ts:14` (body con sfondo scuro esplicito), `:24` (login), `:31` (chat, modale documenti, viewer); `app/globals.css:3-19` (`color-scheme: light dark`, body `#020618`/`#f1f5f9` in `prefers-color-scheme: dark`). Prima del fix: body `rgba(0,0,0,0)` e 9 nodi `color-contrast` nella modale documenti (ID documento slate-400 su bianco, 2.63:1); dopo il fix `npx playwright test e2e/dark-theme.spec.ts e2e/a11y.spec.ts` exit 0 (evidence-T028.json). Correzione collaterale in tema chiaro: ID documento `slate-500` su bianco 4.76:1. Limiti: alcuni hover dark senza variazione visibile; stati di errore/upload non coperti dallo spec dark (tracciati in P2-10). Esito della suite e2e completa (T028): `npx playwright test` exit 0, 20/20.
- Stato: done (T028)

### P2-08 — Precisione dell'highlight delle citazioni
- Criterio della specifica: "UX e micro-interazioni".
- Owner: `frontend-developer`
- Dipendenze: P2-01
- Stima: S
- Fonte: T021, T023 (report ciclo 1).
- Findings: `isSameCitation` marca come attive insieme le citazioni duplicate restituite dal backend (low, T021); aprendo un secondo documento dopo un'interazione la card attiva sborda di 4,3 px (scrollTop 71 contro 83; low/medium, T023).
- Criteri di accettazione:
  - [ ] Con due citazioni identiche nella risposta, solo quella cliccata ha `aria-current` (unit su `isSameCitation`/identità per indice + integration).
  - [ ] Aprendo un secondo documento la card attiva è interamente visibile nel suo contenitore (e2e: bounding box della card dentro quella della lista).
- Stato: todo

### P2-09 — Thumbnail: proporzioni e parsing condiviso
- Criterio della specifica: "UX e micro-interazioni" / performance.
- Owner: `frontend-developer`
- Dipendenze: P2-02
- Stima: S
- Fonte: T029, T033, README §7.
- Findings: placeholder a misura fissa 140x180, le pagine orizzontali vengono tagliate; ogni card esegue un proprio parse pdf.js del Blob condiviso (un download per documento, un parse per card); a 1024 px con sidebar e viewer aperti la colonna chat è ~265 px: card miniatura dei documenti correlati sovrapposte (link "Verifica nel PDF" coperti) e header con "Libreria PDF" sovrapposto al titolo (preesistente, tester T033).
- Criteri di accettazione:
  - [ ] Una pagina orizzontale è mostrata intera nella thumbnail, senza layout shift dopo il caricamento (e2e o integration con dimensioni della pagina mockate).
  - [ ] N card dello stesso documento producono 1 solo parse pdf.js (unit/integration con spy sul loader).
  - [ ] A 1024 px con sidebar e viewer aperti le card dei documenti correlati e gli elementi dell'header della chat non si sovrappongono (e2e: bounding box disgiunti) e i link "Verifica nel PDF" sono cliccabili.
- Stato: todo

### P2-10 — Tema scuro: rifinitura
- Criterio della specifica: "UX e micro-interazioni".
- Owner: `frontend-developer`
- Dipendenze: P2-07
- Stima: S
- Fonte: T028 (`evidence-T028.json`).
- Findings: alcuni hover in tema scuro senza variazione visibile (es. `dark:hover:text-indigo-300` uguale al colore base `dark:text-indigo-300` in `src/features/documents/components/DocumentListModal.tsx:154`); stati di errore e upload non coperti da `e2e/dark-theme.spec.ts`.
- Criteri di accettazione:
  - [ ] Nessuna classe `dark:hover:*` uguale alla corrispondente `dark:*` di base sullo stesso elemento (grep/unit).
  - [ ] `e2e/dark-theme.spec.ts` copre errore di upload e upload in corso con 0 violazioni axe `color-contrast`.
- Stato: todo

### P2-11 — Igiene di proxy e console
- Criterio della specifica: "Integrazione backend" / "Qualità del codice".
- Owner: `frontend-developer`
- Dipendenze: P0-03
- Stima: S
- Fonte: T007, T010, T015, T019, T020, T025.
- Findings: `/favicon.ico` 404 (T010, T015, T020); path `/api/...` senza slash finale → 307 con Location assoluta `http://backend:8000/...` irraggiungibile dal browser (T007, T010); 1 errore console al primo load non analizzato (T019); richieste page-1 ripetute in dev (T025).
- Criteri di accettazione:
  - [ ] `GET /favicon.ico` (o l'icona dichiarata in `app/`) risponde 200 e la console del primo load è vuota (e2e su `page.on('console')` e `page.on('response')`).
  - [ ] `GET /api/documents` senza slash non restituisce una Location verso l'host del backend (e2e o probe nel report del tester).
  - [ ] In un caricamento della home con sessione valida c'è al massimo 1 richiesta per la prima pagina di storico e documenti (e2e su `page.on('request')`, build di produzione).
- Stato: todo

### P2-12 — Stabilità degli e2e e dell'avvio
- Criterio della specifica: "Qualità del codice" (test).
- Owner: `frontend-test-writer` (per `npm start`: `frontend-developer`)
- Dipendenze: nessuna
- Stima: S
- Fonte: T011, T013, T025, T027.
- Findings: residuo statistico sulla race del filechooser in `e2e/keyboard.spec.ts` (T027); gli e2e lasciano dati sul backend reale (upload duplicati, utenti `t25paged` con 45 chat e `t25`; T013, T025); avviso `"next start" does not work with "output: standalone"` (T011).
- Criteri di accettazione:
  - [ ] `npx playwright test e2e/keyboard.spec.ts --repeat-each=20 --workers=1` exit 0.
  - [ ] Gli e2e usano `user_id` univoci per run e il README documenta i dati che restano sul backend (non esiste un endpoint di cancellazione).
  - [ ] `npm run start` (o lo script documentato nel README) avvia il server standalone senza l'avviso.
- Stato: todo

### P2-13 — Viewer PDF: text layer e scroll continuo
- Criterio della specifica: "UX e micro-interazioni".
- Owner: `frontend-developer`
- Dipendenze: P1-08
- Stima: M
- Fonte: README §7.
- Findings: text layer non implementato (testo non selezionabile); navigazione una pagina alla volta.
- Criteri di accettazione:
  - [ ] Il testo della pagina è selezionabile (e2e: `.textLayer` presente con testo non vuoto).
  - [ ] Con lo scroll continuo il click su una citazione porta la regione nel viewport anche su pagine diverse da quella corrente (e2e).
  - [ ] L'overlay dei bounding box resta allineato (test esistenti del viewer verdi).
- Stato: todo

---

## Idee scartate (con motivo)

| Idea | Motivo |
|---|---|
| Migrazione da Next.js a Vite | Lo stack attuale è ammesso dalla specifica ("Next.js in modalità SPA"). La migrazione costa tempo senza punteggio aggiuntivo; il proxy si ottiene con i `rewrites`. |
| Static export (`output: 'export'`) | Incompatibile con i `rewrites`, quindi con il proxy same-origin richiesto da P0-03. |
| Store globale (Redux/Zustand) | Il server state va in TanStack Query e lo stream in `useReducer`; un terzo store non migliora nessun criterio. Servirebbe un ADR. |
| Evidenziazione del `text_quote` nel text layer del PDF | Il backend restituisce sempre la stessa frase placeholder (`BE:src/routes/chat.py:194`): non c'è testo reale da cercare. |
| Virtualizzazione della lista messaggi | Le conversazioni mock sono brevi; nessun criterio ne beneficia. |
| Modalità offline/mock nell'app | MSW copre i test; nell'app aggiungerebbe codice senza migliorare un criterio. |
| i18n multilingua | La specifica non lo chiede; basta una lingua coerente (P2-06). |
| Storybook | Non migliora i criteri valutati; i test RTL coprono i componenti. |
| Pulsante "copia risposta" / export | Nessun criterio della specifica collegato. |

## Findings non trasformati in item (con motivo)

| Finding | Fonte | Motivo |
|---|---|---|
| Documenti globali, `page_count` mock, `text_quote` placeholder, una chat = una coppia Q/A, risposte non tipizzate in OpenAPI | README §7, `docs/AUDIT.md` §2 | Limiti del backend, non correggibili dal frontend. |
| Logout senza cancellazione del cookie | README §7 | Il backend non espone un endpoint di logout. |
| "Annulla" sull'upload quando il backend ha già ricevuto il corpo | T026, README §7 | Limite intrinseco della cancellazione lato client. |
| Suffisso "+" e pulsante extra con totale multiplo di 20 | T025 | Scelta documentata in `docs/adr/0005-paginazione-letterale.md`. |
| Validazione `user_id` ASCII più restrittiva del backend | T004, README §7 | Scelta voluta. |
| Regione "Pagina PDF" raggiungibile solo con 13-14 Tab | T032 | Fuori criterio; lo skip link porta alla lista citazioni, che è il percorso principale. |
| `pkill -f next-server` troppo largo nel tester; log della suite completa in `/tmp` non versionati | T015, T029 | Processo degli agenti: va in `.claude/agents/`, non nella roadmap. |

## Checklist di consegna manuale (utente)

Gli agenti **non** eseguono queste azioni.

- [ ] Decidere se includere `.claude/`, `CLAUDE.md` e `docs/` nel repository consegnato (mostrano il processo, ma vanno riletti).
- [ ] Creare il repository GitHub (privato) e fare push del branch principale.
- [ ] Dare accesso al repository agli utenti GitHub **sisco404**, **ChenEmmaL**, **mastercrys**.
- [ ] Verificare l'avvio da un clone pulito: `git clone … && npm ci && npm run dev` con il backend avviato (`docker-compose up --build` in `test-tecnico-frontend-engineer/`), poi `docker compose up` del frontend. Login, upload, chat, fact-check e storico funzionanti.
- [ ] Inviare l'email di conclusione a **ai@datapizza.tech**, in cc **francescoforesi@datapizza.tech**, **chen@datapizza.tech**, **cristianoortolani@datapizza.tech**, con il link al repository.
