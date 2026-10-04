# Roadmap

> Fonte dei requisiti: `docs/SPEC.md`. Fonte dello stato: `docs/AUDIT.md` (commit `6d18041`).
> Priorità: **P0** = requisito minimo mancante o rotto, rischio XSS, deliverable obbligatorio assente, harness di test assente · **P1** = miglioramento diretto su un criterio di valutazione · **P2** = elemento differenziante coerente con i criteri.
> Lo stato di ogni item è aggiornato **solo** da `documentation-writer`.
> Convenzione per i test: "unit" e "integration" = Vitest + RTL + MSW (`npm run test`); "e2e" = Playwright contro il backend reale (`npm run e2e`).

## Stato attuale (aggiornato a T007)

| Criterio della specifica | Stato | Evidenza | Item |
|---|---|---|---|
| 1. Login mock + cookie | ✅ | `services/api-client.ts` (proxy same-origin, credentials: 'same-origin') | P0-03 |
| 1. Validazione `user_id` (vuoto / caratteri / lunghezza) | ✅ | `services/auth-service.ts:12` (USER_ID_MAX_LENGTH = 100) | P0-06 |
| 2. Upload multiplo, stato, errori | ⚠️ | `components/documents/DocumentUploadDropzone.tsx:70-85`; messaggi backend non mappati | P1-04 |
| 2. Lista documenti | ⚠️ | `components/documents/DocumentListModal.tsx:33-70,202` | P1-06 |
| 3. Layout chat + Invia | ✅ | `components/chat/ChatWorkspace.tsx:359-524` | — |
| 3. Streaming NDJSON incrementale | ⚠️ | `utils/ndjson.ts` ✅; un render per carattere in `components/chat/ChatWorkspace.tsx:216-223` | P1-03 |
| 3. Errori di stream (`type:"error"`, righe malformate) | ✅ | `utils/ndjson.ts:5-34` (NDJSONParseError, parseLine con try-catch); `components/chat/ChatWorkspace.tsx:247` (status: 'error' non sovrascritto da completed) | P0-05 |
| 3. Interruzione pulita | ✅ | `components/chat/ChatWorkspace.tsx:114-127` | — |
| 3. Markdown + HTML inline sicuro | ✅ | `components/chat/MarkdownRenderer.tsx` (rehype-raw + rehype-sanitize, nessun dangerouslySetInnerHTML) | P0-04 |
| 4. Documenti correlati (filename, pagina, quote) | ✅ | `components/chat/RelatedDocumentsSection.tsx:41,75-86` | — |
| 4. Bounding box sul PDF | ⚠️ | `components/pdf/BoundingBoxOverlay.tsx` ✅; worker CDN `components/pdf/PdfFactCheckViewer.tsx:98`; niente scroll alla regione | P1-08, P1-09 |
| 5. Storico chat lista + dettaglio | ⚠️ | `components/chat/ChatWorkspace.tsx:365-366` (loading fisso a false); `services/chat-service.ts:110-176` | P1-06, P1-07 |
| Qualità: struttura / TS / separazione API-UI | ⚠️ | `components/chat/ChatWorkspace.tsx` (562 righe); BackendConfigModal rimosso da P0-03 (T007) | P1-01, P1-02, P1-11 |
| UX: loading, errori comprensibili, layout | ⚠️ | `services/api-client.ts:22-42`; viewer PDF a schermo intero | P1-04, P1-06, P1-09, P1-10 |
| Uso backend: cookie, metodi, header, body | ⚠️ | P0-03 ✅ proxy same-origin; P0-05 ✅ stream error; P0-06 ✅ validazione user_id; P1-02/P1-07 ⚠️ `services/chat-service.ts:65`, `components/chat/ChatWorkspace.tsx:211` (`chat_id` ancora inviato nel body, todo) | P0-03, P0-05, P0-06, P1-02, P1-07 |
| Deliverable: Dockerfile | ❌ | assente | P0-07 |
| Deliverable: README accurato | ⚠️ | In corso (P0-08) | P0-08 |
| Harness di test / quality gate | ✅ | `package.json` (typecheck, lint, test, e2e); `vitest.config.ts`; `playwright.config.ts`; MSW; e2e 3/3 passed | P0-01, P0-02 |

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
  - [ ] `docker build -t docfact-frontend .` termina con exit 0. Build multi-stage `node:22-alpine` con `npm ci` e output `standalone`, eseguito come utente non root.
  - [ ] `BACKEND_URL` è passato come build arg o env (i `rewrites` sono valutati a build time) e documentato.
  - [ ] `docker-compose.yml` avvia frontend e backend (`build: ../test-tecnico-frontend-engineer/backend`, percorso documentato). Con `docker compose up`, `curl -s -o /dev/null -w '%{http_code}' localhost:3000` restituisce 200 e `curl -s -X POST localhost:3000/api/auth/login -H 'Content-Type: application/json' -d '{"user_id":"t"}'` restituisce 200.
  - [ ] Nessuna risorsa caricata da CDN a runtime (dipende da P1-08 per PDF.js; fino ad allora è un limite dichiarato nel README).
- Stato: todo

### P0-08 — README accurato con decisioni, trade-off e limiti
- Criterio della specifica: "Deliverable attesi › Un README che spieghi come avviare il frontend… decisioni architetturali, trade-off, limiti, cose che si sarebbero fatte con più tempo".
- Owner: `documentation-writer`
- Dipendenze: P0-03, P0-07 (aggiornato di nuovo a ogni item concluso)
- Stima: S
- Criteri di accettazione:
  - [ ] Sezioni presenti: Avvio locale, Avvio con Docker, Architettura, Streaming NDJSON, Rendering PDF e coordinate, Decisioni e trade-off, Limiti noti, Con più tempo farei.
  - [ ] Ogni affermazione tecnica cita un file esistente. Nessuna frase "Production-ready" e nessuna istruzione di modificare il backend.
  - [ ] I limiti del backend sono dichiarati: documenti globali, `page_count` mock, `text_quote` placeholder, una chat = una coppia Q/A, risposte non tipizzate in OpenAPI.
  - [ ] La sezione "Sviluppo con Claude Code", con il limite noto del controllo Bash best-effort di `.claude/hooks/guard-orchestrator.mjs`, è conservata.
  - [ ] I comandi del README (`npm ci`, `npm run dev`, `docker compose up`) sono stati eseguiti da `frontend-tester` su un clone pulito, con evidenza in `.claude/reports/`.
- Stato: todo

---

## P1 — Criteri di valutazione

### P1-01 — Struttura per feature e livello API unico
- Criterio della specifica: "Qualità del codice › Struttura del progetto React" e "Separazione tra logica di chiamata API e componenti UI".
- Owner: `frontend-developer` (decisione trasversale: escalation a `opus` secondo CLAUDE.md E.7)
- Dipendenze: P0-02, P0-03
- Stima: L
- Criteri di accettazione:
  - [ ] Esistono `src/features/{auth,documents,chat,factcheck,history}/` con `components/`, `hooks/` e `types.ts`, più `src/components/ui/` e `src/api/`.
  - [ ] `src/api/` espone un client tipizzato. Gli errori sono normalizzati in `ApiError { status, code, userMessage, cause }`, con test unit per rete, 4xx con `detail` stringa, 422 con `detail[]` e abort.
  - [ ] Una regola ESLint (`no-restricted-globals` o `no-restricted-syntax` su `fetch`) fa fallire `npm run lint` se `fetch` compare fuori da `src/api/`.
  - [ ] `components/chat/ChatWorkspace.tsx` (o il suo successore) non supera 200 righe; la logica di stream vive in un hook.
  - [ ] ADR `docs/adr/0002-struttura-per-feature.md`.
- Stato: todo

### P1-02 — Tipi API da OpenAPI e risposte allineate al backend reale
- Criterio della specifica: "Utilizzo del backend › Capacità di leggere e capire la documentazione in Swagger" e "Uso coerente di HTTP methods, headers, body".
- Owner: `frontend-developer`
- Dipendenze: P1-01
- Stima: M
- Criteri di accettazione:
  - [ ] Script `gen:api` (`openapi-typescript docs/api/openapi.json -o src/api/schema.d.ts`); i tipi di request (`LoginRequest`, `ChatRequest`) derivano da `schema.d.ts`.
  - [ ] I tipi di risposta sono scritti a mano da `docs/AUDIT.md` §2: `Document`, `UploadResponse`, `ChatRecord {id, user_id, created_at, query, response, citations?}`. Nessuna index signature `[key: string]: unknown`.
  - [ ] I normalizzatori speculativi sono rimossi (grep `obj.sessions`, `obj.items`, `obj.files`, `obj.chats`: 0).
  - [ ] Test: il body di `POST /api/chat/` contiene solo le chiavi `query` ed eventualmente `history` (niente `chat_id`). L'header `Accept` è `application/x-ndjson`.
- Stato: todo

### P1-03 — Hook di stream con `useReducer` e batching per frame
- Criterio della specifica: "Gestione dello streaming › Aggiornamento incrementale della UI"; "Obiettivo › come vengono gestiti stato, streaming e concorrenza".
- Owner: `frontend-developer`
- Dipendenze: P0-05, P1-01
- Stima: M
- Criteri di accettazione:
  - [ ] Hook `useChatStream` con `useReducer` e azioni tipizzate (`start`, `delta`, `citations`, `error`, `abort`, `done`). Test unit del reducer puro per ogni azione.
  - [ ] I `delta` sono accumulati e applicati con `requestAnimationFrame`. Test: 500 chunk `content` consegnati in un solo tick producono al massimo 5 render del componente messaggio (contatore di render o React Profiler), e il testo finale è identico alla concatenazione.
  - [ ] Abort all'unmount, al cambio di chat e su Stop. Test: dopo `abort()` non arrivano più dispatch (nessun warning di update su componente smontato) e il messaggio parziale resta con stato `aborted`.
  - [ ] ADR `docs/adr/0003-invio-durante-stream.md`: un nuovo invio durante uno stream attivo è disabilitato oppure interrompe il precedente. Test che verifica il comportamento scelto.
- Stato: todo

### P1-04 — Mappa errori → messaggi comprensibili
- Criterio della specifica: "UX › Errori comprensibili per l'utente finale (non solo messaggi tecnici)"; "Funzionalità minime › 2. errori (file non valido, nessun file selezionato…)".
- Owner: `frontend-developer`
- Dipendenze: P1-01
- Stima: S
- Criteri di accettazione:
  - [ ] Una sola mappa `codice → messaggio` in italiano per: rete irraggiungibile, 401, 404 chat, 422 login, 400 upload "not recognized" (con il nome del file estratto), 422 upload senza file, 400 query vuota/troppo lunga, chunk `error`, riga malformata, abort.
  - [ ] Test unit per ogni voce della mappa. Nessun messaggio mostrato contiene uno status code numerico, `detail`, uno stack o l'URL del backend.
  - [ ] e2e: upload di un PDF non ammesso → messaggio "«nome.pdf» non è uno dei documenti di test" (o equivalente) visibile, e la lista documenti non cambia.
  - [ ] Il dettaglio tecnico va solo in `console` (`cause`).
- Stato: todo

### P1-05 — Sessione coerente con il cookie e gestione del 401
- Criterio della specifica: "Funzionalità minime › 1. gestione del cookie lato browser"; "Utilizzo del backend › autenticazione via cookie".
- Owner: `frontend-developer`
- Dipendenze: P1-01
- Stima: S
- Criteri di accettazione:
  - [ ] Qualsiasi 401 da `src/api/` riporta alla schermata di login con il messaggio "Sessione scaduta, accedi di nuovo" (test integration con MSW).
  - [ ] Nessun accesso a `localStorage` durante il render. e2e: la console della pagina non contiene errori di idratazione al reload da loggato.
  - [ ] e2e: dopo `context.clearCookies()` e un'azione (apertura documenti), l'utente vede il login, non un errore generico.
  - [ ] Logout: lo stato utente e la cache di query vengono svuotati. Il README documenta che il backend non espone un endpoint di logout e che il cookie resta finché non viene sovrascritto.
- Stato: todo

### P1-06 — Server state con TanStack Query: documenti e storico
- Criterio della specifica: "UX › Stati di loading chiari (… caricamento storico)"; "Funzionalità minime › 2. lista documenti" e "› 5. Lista delle chat"; "Qualità › stato globale vs locale".
- Owner: `frontend-developer`
- Dipendenze: P1-01
- Stima: M
- Criteri di accettazione:
  - [ ] `useDocuments`, `useChatList` e `useChatDetail` con TanStack Query. Upload riuscito → invalida i documenti; fine stream → invalida lo storico.
  - [ ] Test integration: mentre `GET /api/chat/` è pendente (MSW con delay) la sidebar mostra un indicatore di loading accessibile (`role="status"`); in caso di errore, un messaggio e un pulsante "Riprova" che ripete la richiesta.
  - [ ] Test: selezione rapida della chat A (risposta lenta) e poi della B (veloce) → viene mostrata B, anche quando A risponde dopo.
  - [ ] Storico ordinato per `created_at` decrescente. La lista documenti non mostra `page_count` (mock fisso a 5, `BE:src/dependencies.py:25`).
- Stato: todo

### P1-07 — Modello dello storico coerente con il backend
- Criterio della specifica: "Funzionalità minime › 5. L'integrazione con lo storico deve essere coerente con la UI principale di chat"; "Utilizzo del backend › corretta comprensione degli endpoint".
- Owner: `frontend-developer`
- Dipendenze: P1-02, P1-06
- Stima: M
- Criteri di accettazione:
  - [ ] ADR `docs/adr/0004-modello-storico.md`: una chat del backend è una coppia Q/A (`BE:src/dependencies.py:39-57`). La UI la presenta come voce di storico (titolo = `query`, data = `created_at`). La conversazione multi-turno è solo locale e il campo `history` viene inviato senza promettere effetti (il backend lo ignora).
  - [ ] e2e: invio di 2 domande → la sidebar mostra 2 nuove voci, la più recente in alto.
  - [ ] e2e: selezione di una voce → sono visibili domanda, risposta renderizzata e "Documenti correlati" con le citazioni salvate, e da lì il PDF si apre.
  - [ ] Una nuova domanda mentre è selezionata una voce dello storico non modifica quella voce e crea una nuova voce.
- Stato: todo

### P1-08 — Viewer PDF affidabile: react-pdf, worker locale, scroll alla regione
- Criterio della specifica: "Funzionalità minime › 4. mostrare visivamente le bounding regions sul PDF"; "UX › Layout efficace per … fact-checking/bounding box".
- Owner: `frontend-developer`
- Dipendenze: P1-01
- Stima: M
- Criteri di accettazione:
  - [ ] Rendering con `react-pdf` e worker servito localmente. e2e: nessuna richiesta di rete verso `cdnjs.cloudflare.com` o `cdn.jsdelivr.net` durante l'apertura di un PDF.
  - [ ] Funzione pura `inchesRectToPx(rect, pageWidthPt, renderedWidthPx)` (pollici × 72 = pt; pt × renderedWidthPx / pageWidthPt = px). Test unit: `[1,1,2,0.5]` su una pagina di 612 pt renderizzata a 612 px → `{left:72, top:72, width:144, height:36}`; con 1224 px tutti i valori raddoppiano.
  - [ ] Il selettore di origine `top-left`/`bottom-left` è rimosso; l'origine è documentata (`BE:tests/bbox_visualization.py:48`).
  - [ ] e2e: apertura di una citazione → la pagina mostrata è uguale a `bounding_regions[0].page_number`, ed esiste almeno un elemento `[data-testid="bbox"]` visibile nel viewport (scroll automatico alla prima regione).
  - [ ] Una citazione con regioni su più pagine mostra l'elenco delle pagine con regioni e la navigazione tra di esse (test integration con una fixture a 2 pagine).
- Stato: todo

### P1-09 — Layout affiancato conversazione + fact-checking
- Criterio della specifica: "UX › Layout efficace per mostrare conversazione, documenti correlati, fact-checking/bounding box".
- Owner: `frontend-developer`
- Dipendenze: P1-08
- Stima: M
- Criteri di accettazione:
  - [ ] A viewport ≥ 1024 px il viewer PDF è un pannello laterale e la conversazione resta visibile e scrollabile (e2e: messaggio e PDF entrambi `toBeInViewport()`).
  - [ ] A viewport < 1024 px il viewer è un drawer/modal a schermo intero con pulsante di chiusura.
  - [ ] All'apertura il focus va al pannello; `Escape` lo chiude e il focus torna alla card della citazione (e2e da tastiera).
  - [ ] La citazione attiva è evidenziata sia nella lista della risposta sia sul PDF.
- Stato: todo

### P1-10 — Flusso principale navigabile da tastiera
- Criterio della specifica: "UX e micro-interazioni"; controllo osservabile di `frontend-tester`: "il flusso principale è navigabile da tastiera".
- Owner: `frontend-developer`
- Dipendenze: P1-01
- Stima: S
- Criteri di accettazione:
  - [ ] Le card citazione e le card di suggerimento sono `<button>` (grep `<div onClick` in `src/`: 0).
  - [ ] L'area messaggi ha `aria-live="polite"`. Dopo l'invio il focus resta sull'input; a fine stream non viene rubato.
  - [ ] e2e da sola tastiera: login → apertura documenti → upload → invio domanda → apertura citazione → chiusura viewer, senza mouse.
- Stato: todo

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

---

## P2 — Differenzianti

### P2-01 — Highlight bidirezionale citazione ↔ PDF
- Criterio della specifica: "Obiettivo › come vengono presentate le informazioni di fact-checking (documenti correlati, pagine, highlight)".
- Owner: `frontend-developer`
- Dipendenze: P1-09
- Stima: S
- Criteri di accettazione:
  - [ ] Click su un box nel PDF → la card corrispondente riceve `aria-current="true"` e diventa visibile (test integration).
  - [ ] Hover o focus sulla card → i box di quella citazione ricevono la classe attiva (test integration).
- Stato: todo

### P2-02 — Mini-thumbnail della pagina con le regioni nella card citazione
- Criterio della specifica: "Funzionalità minime › 4. Visualizzazione (… mini-thumbnail …)"; "Obiettivo › presentazione del fact-checking".
- Owner: `frontend-developer`
- Dipendenze: P1-08
- Stima: M
- Criteri di accettazione:
  - [ ] Ogni card mostra una miniatura della pagina citata con i rettangoli disegnati, renderizzata in modo lazy (solo quando visibile, con `IntersectionObserver`).
  - [ ] e2e: con 5 citazioni vengono scaricati al massimo N PDF distinti (cache per `document_id`).
- Stato: todo

### P2-03 — Rendering stabile del Markdown durante lo stream
- Criterio della specifica: "Gestione dello streaming › Aggiornamento incrementale della UI".
- Owner: `frontend-developer`
- Dipendenze: P0-04, P1-03
- Stima: S
- Criteri di accettazione:
  - [ ] Test: lo stream carattere per carattere della risposta con `<table>` non mostra mai testo HTML letterale (`&lt;table` o `<tr>` come testo) in nessuno snapshot intermedio campionato.
- Stato: todo

### P2-04 — Paginazione di storico e documenti
- Criterio della specifica: "Utilizzo del backend › Corretta comprensione degli endpoint" (`limit`/`offset`, `BE:src/routes/chat.py:250-251`).
- Owner: `frontend-developer`
- Dipendenze: P1-06
- Stima: S
- Criteri di accettazione:
  - [ ] Con 25 chat (MSW) la sidebar mostra 20 voci e un pulsante "Carica altre" che richiede `offset=20` (verifica della query string nel test).
- Stato: todo

### P2-05 — Annullamento dell'upload in corso
- Criterio della specifica: "UX › Stati di loading chiari (… upload documenti)"; "Obiettivo › concorrenza lato client".
- Owner: `frontend-developer`
- Dipendenze: P1-04
- Stima: S
- Criteri di accettazione:
  - [ ] Durante l'upload è visibile il pulsante "Annulla", che chiama `AbortController.abort()`. Test: dopo l'annullamento, nessun messaggio di successo né di errore e lista documenti invariata.
- Stato: todo

### P2-06 — Accessibilità avanzata e lingua
- Criterio della specifica: "UX e micro-interazioni".
- Owner: `frontend-developer`
- Dipendenze: P1-10
- Stima: S
- Criteri di accettazione:
  - [ ] `<html lang="it">` (oggi `lang="en"` in `app/layout.tsx:21`).
  - [ ] e2e con `@axe-core/playwright` su login, chat e viewer: 0 violazioni `serious` o `critical`.
- Stato: todo

### P2-07 — Tema scuro
- Criterio della specifica: "UX e micro-interazioni" (layout e leggibilità).
- Owner: `frontend-developer`
- Dipendenze: P1-09
- Stima: S
- Criteri di accettazione:
  - [ ] Con `colorScheme: 'dark'` in Playwright, lo sfondo di `body` è scuro e il contrasto testo/sfondo dei messaggi è ≥ 4.5:1 (axe `color-contrast`: 0 violazioni).
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

## Checklist di consegna manuale (utente)

Gli agenti **non** eseguono queste azioni.

- [ ] Decidere se includere `.claude/`, `CLAUDE.md` e `docs/` nel repository consegnato (mostrano il processo, ma vanno riletti).
- [ ] Creare il repository GitHub (privato) e fare push del branch principale.
- [ ] Dare accesso al repository agli utenti GitHub **sisco404**, **ChenEmmaL**, **mastercrys**.
- [ ] Verificare l'avvio da un clone pulito: `git clone … && npm ci && npm run dev` con il backend avviato (`docker-compose up --build` in `test-tecnico-frontend-engineer/`), poi `docker compose up` del frontend. Login, upload, chat, fact-check e storico funzionanti.
- [ ] Inviare l'email di conclusione a **ai@datapizza.tech**, in cc **francescoforesi@datapizza.tech**, **chen@datapizza.tech**, **cristianoortolani@datapizza.tech**, con il link al repository.
