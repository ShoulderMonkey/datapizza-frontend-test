# Audit — stato iniziale del frontend

> Data: 2026-10-04 · Commit di riferimento: `6d18041` (baseline export AI Studio).
> Metodo: sola lettura del codice e verifiche empiriche in ambiente isolato (scratchpad / `uv run --no-project`), senza modificare il repo backend né i sorgenti del frontend.
> Ogni riga cita un file del repo frontend, oppure `BE:` = `../test-tecnico-frontend-engineer/backend/`.

## 1. Stack

| Voce | Valore | Evidenza |
|---|---|---|
| Tipo di progetto | **Next.js (App Router)**, non Vite e non AI Studio senza bundler (niente `importmap`/esm.sh) | `package.json:6` (`next dev`), `package.json:22` (`next ^15.4.9`), `app/layout.tsx`, `app/page.tsx` |
| Rendering | Unica pagina `'use client'`: l'intera UI è client-side | `app/page.tsx:1` |
| Output build | `output: 'standalone'` (server Node), non static export | `next.config.ts:22` |
| React | `^19.2.1` | `package.json:25` |
| TypeScript | `5.9.3`, `strict: true` | `package.json:42`, `tsconfig.json:7` |
| Package manager | **bun** (presente solo `bun.lock`, nessun `package-lock.json`); `bun` non è installato su questa macchina, `npm 11.6.2` sì | `bun.lock`; `which bun` → not found |
| `node_modules` | Non installati: typecheck/lint non eseguibili oggi | assenza della cartella `node_modules/` |
| Script npm esistenti | `dev`, `build`, `start`, `lint` (`eslint .`), `clean` | `package.json:5-11` |
| Script mancanti | `typecheck`, `test`, `e2e` | `package.json:5-11` |
| ESLint | Due config in conflitto: flat (`eslint.config.mjs`) **e** legacy (`.eslintrc.json`); `eslint-config-next 16.0.8` con `next 15` | `eslint.config.mjs:1-11`, `.eslintrc.json:1-3`, `package.json:37-38` |
| Lint in build | Disattivato (`ignoreDuringBuilds: true`) | `next.config.ts:5-7` |
| PDF | `pdfjs-dist ^4.10.38` usato direttamente (non `react-pdf`) | `package.json:23`, `components/pdf/PdfFactCheckViewer.tsx:94` |
| Markdown | `react-markdown ^9` + `remark-gfm`, **senza** `rehype-raw`/`rehype-sanitize`; `dompurify` applicato prima del parsing | `package.json:27-28`, `components/chat/MarkdownRenderer.tsx:16-23` |
| Server state | Nessuna libreria (né TanStack Query né SWR); `useState` + `useEffect` manuali | `components/chat/ChatWorkspace.tsx:44-111` |
| Residui AI Studio | `@google/genai` e `motion` (mai importati), `firebase-tools` (dev), `metadata.json`, `.env.example` con `GEMINI_API_KEY`, `images.remotePatterns` picsum, `DISABLE_HMR` | `package.json:13,21,39`; `metadata.json:5`; `.env.example:4`; `next.config.ts:12-20,24-33`; grep di `@google/genai` e `motion` nei sorgenti: 0 occorrenze |
| Codice morto | `hooks/use-mobile.ts` e `lib/utils.ts` (`cn`) non importati da nessun file | grep `useIsMobile` e `cn(`: solo nei file di definizione |

## 2. Fatti del backend rilevanti per il frontend (letti dal sorgente)

Lo schema `docs/api/openapi.json` è stato generato da `BE:src/app.py` con `app.openapi()`, perché il backend non era in esecuzione. **Lo schema non contiene schemi di risposta** (tutti i `200` sono `{"schema": {}}`) e non contiene `maxLength` per `user_id`. Per questo i limiti sotto sono letti dal codice Python.

| Fatto | Evidenza |
|---|---|
| `user_id`: non vuoto, ≤ **100** caratteri, solo `isalnum()` + `-` `_`; errore → **422** con `detail[]` Pydantic | `BE:src/routes/auth.py:13-21`; verificato: 101 caratteri → 422, 100 → 200 |
| `isalnum()` di Python accetta lettere Unicode (`"àè"` → 200), quindi il backend è più permissivo di `^[a-zA-Z0-9_-]+$` | verificato con TestClient |
| Cookie `user_id`: `HttpOnly`, `SameSite=lax`, `Path=/`, nessun `Max-Age` | `BE:src/routes/auth.py:36-41` |
| Risposta login: `{"user_id": string}` | `BE:src/routes/auth.py:42` |
| Senza cookie → **401** `{"detail": "Not authenticated..."}` su tutte le rotte documenti/chat | `BE:src/dependencies.py:79-89` |
| Upload: campo `files`; hash non ammesso → **400** `detail` stringa; nessun file → **422** (validazione FastAPI, non il 400 del codice) | `BE:src/routes/documents.py:30-57`; verificato: no files → 422 `Field required` |
| Upload OK → `{"message", "documents": [{id, filename, content_type, upload_date, status, page_count, file_hash}]}`; `page_count` è sempre **5** (mock, non reale) | `BE:src/dependencies.py:19-30`, `BE:src/routes/documents.py:92-95` |
| `GET /api/documents/` e `GET /api/chat/` sono paginati (`limit` 1–100, default **20**; `offset`) e restituiscono **array nudi** | `BE:src/routes/documents.py:98-121`, `BE:src/routes/chat.py:246-272` |
| I documenti sono **globali** (non filtrati per utente); le chat sono filtrate per `user_id` | `BE:src/routes/documents.py:120`, `BE:src/routes/chat.py:269-271` |
| `POST /api/chat/` body: `query` (obbligatorio), `history` opzionale (**ignorato** dal generatore); `chat_id` **non** esiste nello schema | `BE:src/routes/chat.py:16-20,119-128`; `docs/api/openapi.json` (`ChatRequest`) |
| Query vuota → 400; query > 10000 caratteri → 400 | `BE:src/routes/chat.py:228-236` |
| Stream: `application/x-ndjson`, una riga JSON per **carattere** (`delta` di 1 char, ~20 ms) | `BE:src/routes/chat.py:135-138`; verificato: 494 righe per una risposta |
| Chunk `citations` emesso **solo se** esistono documenti; altrimenti lo stream termina senza citazioni | `BE:src/routes/chat.py:142-201` |
| Chunk errore: `{"type":"error","message": "Streaming error: ..."}` | `BE:src/routes/chat.py:207-210` |
| Una "chat" del backend = **una singola coppia domanda/risposta** `{id, user_id, created_at, query, response, citations?}`, salvata a fine stream; l'id **non** viene restituito nello stream | `BE:src/dependencies.py:39-57`, `BE:src/routes/chat.py:204-206` |
| `text_quote` è sempre la stessa stringa placeholder | `BE:src/routes/chat.py:194` |
| Bounding box: `[x, y, w, h]` in **pollici**, origine **top-left**, `y` verso il basso; una citazione può avere più regioni | `BE:tests/bbox_visualization.py:31,48-49,74-84`; `BE:data/mock_qa_bbox/bbox.json` |
| CORS: `allow_origins=["*"]` + `allow_credentials=True` | `BE:src/app.py:9-15` |
| L'immagine Docker installa `fastapi` **senza versione** (ignora `uv.lock`), quindi la versione di Starlette dipende dalla data di build | `BE:Dockerfile` (riga `RUN pip install --no-cache-dir fastapi uvicorn ...`) |
| Con **Starlette 0.50.0** (versione in `BE:uv.lock:354`), il primo `POST /api/auth/login` cross-origin senza cookie risponde `Access-Control-Allow-Origin: *` + `Access-Control-Allow-Credentials: true`; con Starlette 1.7.0 risponde con l'origin esplicito | verificato con TestClient su entrambe le versioni |

## 3. Mappa dei requisiti

Legenda: ✅ completo · ⚠️ parziale · ❌ assente o rotto.

### Funzionalità minime

| Requisito | Stato | Evidenza | Nota |
|---|---|---|---|
| 1a. Schermata login con `user_id` / default | ✅ | `components/auth/LoginForm.tsx:20-27,101-192` | Preset e default `test_user` |
| 1b. `POST /api/auth/login` + cookie gestito dal browser | ⚠️ | `services/auth-service.ts:35-41`, `services/api-client.ts:57-61` | Chiamata **cross-origin** diretta a `localhost:8000` con `credentials: 'include'`. Con Starlette 0.50.0 la risposta contiene `ACAO: *` + credentials, che la spec Fetch vieta: il browser rifiuta la risposta (inferenza dalla spec, da confermare con Playwright). Nessun proxy same-origin. |
| 1c. Validazione: vuoto | ✅ | `services/auth-service.ts:9-11` | |
| 1c. Validazione: caratteri non ammessi | ✅ | `services/auth-service.ts:5,12-16` | Più restrittiva del backend sugli Unicode (accettabile, va documentata) |
| 1c. Validazione: troppo lungo | ⚠️ | `services/auth-service.ts:18-19` | Limite client **64** contro **100** del backend (`BE:src/routes/auth.py:15`): rifiuta valori validi |
| 1d. Errori 422 del backend leggibili | ⚠️ | `services/api-client.ts:29-31` | Mostra `msg` Pydantic in inglese ("Value error, ...") |
| 1e. Sessione coerente con il cookie | ⚠️ | `app/page.tsx:10`, `services/auth-service.ts:43-49` | Utente "loggato" letto da `localStorage` senza verificare il cookie; nessuna gestione globale del 401. `useState(() => localStorage...)` in un componente renderizzato anche lato server causa un mismatch di idratazione. |
| 2a. UI upload multiplo PDF | ✅ | `components/documents/DocumentUploadDropzone.tsx`, `services/document-service.ts:35-59` | `FormData` con campo `files` ripetuto |
| 2b. Stato di caricamento | ✅ | `components/documents/DocumentUploadDropzone.tsx:70-85` | |
| 2c. Errori: nessun file, non PDF, PDF non ammesso | ⚠️ | `components/documents/DocumentUploadDropzone.tsx:36,66,81`; `services/api-client.ts:28` | Il 400 "not recognized" del backend è mostrato in inglese, così com'è. Nessuna mappa codice → messaggio. |
| 2d. Lista documenti `GET /api/documents/` | ⚠️ | `components/documents/DocumentListModal.tsx:33-70`, `services/document-service.ts:9-30` | Funziona, ma ignora la paginazione (max 20) e mostra `page_count` mock (sempre 5) come reale (`components/documents/DocumentListModal.tsx:202`) |
| 3a. Layout chat: lista messaggi, input, Invia | ✅ | `components/chat/ChatWorkspace.tsx:359-524`, `components/chat/ChatComposer.tsx` | |
| 3b. Streaming NDJSON incrementale | ⚠️ | `utils/ndjson.ts:8-69`, `components/chat/ChatWorkspace.tsx:214-234` | Il parser gestisce correttamente le righe spezzate. La UI però fa `setMessages` **a ogni carattere**: nessun batching per frame. |
| 3c. Stato loading | ✅ | `components/chat/ChatMessageItem.tsx:59-81` | |
| 3d. Errore query vuota | ✅ | `components/chat/ChatComposer.tsx:43-46` | |
| 3e. Errore di rete / HTTP prima dello stream | ⚠️ | `services/api-client.ts:122-155`, `components/chat/ChatWorkspace.tsx:284-300` | Gestito, ma il messaggio mostrato contiene l'URL tecnico del backend |
| 3f. Chunk `type: "error"` | ❌ | `components/chat/ChatWorkspace.tsx:235-265` | **Bug**: dopo il chunk di errore il ciclo prosegue e la finalizzazione (righe 254-265) sovrascrive `status: 'error'` con `'completed'`, quindi il banner di errore sparisce |
| 3g. Riga NDJSON malformata | ⚠️ | `utils/ndjson.ts:48-50` | Scartata con un `console.warn`, invisibile all'utente |
| 3h. Fine stream | ✅ | `components/chat/ChatWorkspace.tsx:253-265` | |
| 3i. Stop / interruzione pulita | ✅ | `components/chat/ChatComposer.tsx:96-105`, `components/chat/ChatWorkspace.tsx:114-127,270-283` | `AbortController` presente, abort anche all'unmount e al cambio di chat |
| 3j. Markdown (titoli, liste, tabelle) | ⚠️ | `components/chat/MarkdownRenderer.tsx:16-23` | DOMPurify sul **sorgente Markdown** prima del parsing: `>` diventa `&gt;` e i blockquote si rompono (verificato con DOMPurify 3 + jsdom) |
| 3k. HTML inline (`<table>`, `<strong>`, `<ul>`) | ❌ | `components/chat/MarkdownRenderer.tsx:22-23,105` | Senza `rehype-raw`, react-markdown 9.1.0 rende l'HTML come **testo escapato** (verificato: `<table>` → `&lt;table&gt;`). Le risposte del backend contengono `<table>`/`<ul>` (`BE:src/routes/chat.py:44-63`). |
| 3l. Sicurezza XSS | ✅ | `components/chat/MarkdownRenderer.tsx:22-105`; grep `dangerouslySetInnerHTML`: 0 occorrenze | Sicuro oggi solo perché l'HTML non viene interpretato. Il fix 3k deve introdurre `rehype-sanitize`. |
| 4a. Sezione "Documenti correlati" con filename, pagina, `text_quote` | ✅ | `components/chat/RelatedDocumentsSection.tsx:41,75-86` | |
| 4b. Bounding box visive sul PDF | ✅ | `components/pdf/BoundingBoxOverlay.tsx:46-123`, `utils/coordinates.ts:28-58` | Conversione corretta: `x / (pageWidthPt/72)` in percentuale |
| 4c. Pagina corretta, più regioni e più pagine | ⚠️ | `components/pdf/BoundingBoxOverlay.tsx:47`, `components/chat/ChatWorkspace.tsx:342` | Filtra le regioni per pagina, ma senza scroll fino alla regione (grep `scrollIntoView` in `components/pdf/`: 0) e senza indicare le altre pagine che contengono regioni |
| 4d. Origine coordinate | ⚠️ | `components/pdf/PdfFactCheckViewer.tsx:57,375-376` | Espone all'utente un selettore `top-left`/`bottom-left`, anche se l'origine è nota (top-left) |
| 4e. Recupero PDF da `GET /api/documents/{id}/file` | ✅ | `services/document-service.ts:64-71` | |
| 4f. PDF.js funzionante offline/Docker | ⚠️ | `components/pdf/PdfFactCheckViewer.tsx:98,103` | Worker da cdnjs e cMaps da jsdelivr (versione hard-coded `4.10.38` contro un range `^4.10.38`) |
| 5a. Lista chat `GET /api/chat/` | ⚠️ | `services/chat-service.ts:15-36`, `components/chat/ChatSidebar.tsx` | Funziona. Il loading è cablato a `false` ed errori/null sono ignorati (`components/chat/ChatWorkspace.tsx:365-366,78-80`). Ordine non per data, nessuna paginazione. |
| 5b. Dettaglio `GET /api/chat/{id}` | ⚠️ | `services/chat-service.ts:41-48,110-176`, `components/chat/ChatWorkspace.tsx:130-149` | Il normalizzatore indovina campi inesistenti (`messages`, `history`, `title`...). Nessuna protezione da race tra selezioni rapide. |
| 5c. Coerenza storico ↔ UI | ⚠️ | `components/chat/ChatWorkspace.tsx:186-212` | La UI tratta una chat come conversazione multi-turno e invia `chat_id` (inesistente nello schema). Il backend crea però una chat **nuova per ogni domanda** (`BE:src/routes/chat.py:204`). |

### Criteri di valutazione

| Criterio | Stato | Evidenza | Nota |
|---|---|---|---|
| Struttura del progetto (componenti, hook, stato globale/locale) | ⚠️ | `components/chat/ChatWorkspace.tsx` (562 righe) | Orchestrazione di stream, storico, documenti e PDF in un unico componente. Nessun hook di feature e nessuna struttura per feature. |
| Pulizia / TypeScript | ⚠️ | `tsconfig.json:7`; `types/chat.ts:25,45`; `types/document.ts:11`; `components/pdf/PdfFactCheckViewer.tsx:45,141-146` | Nessun `any` (grep: 0), ma tipi con `[key: string]: unknown`, `pdfDoc: unknown` più un cast manuale e `request<T>` che fa `as T` senza validazione (`services/api-client.ts:83`) |
| Separazione API / UI | ⚠️ | `services/*.ts` | Livello `services/` presente, ma con `fetch` dentro un componente (`components/settings/BackendConfigModal.tsx:53`) e logica di stream nel componente (`components/chat/ChatWorkspace.tsx:162-306`) |
| Consumo NDJSON | ✅ | `utils/ndjson.ts:22-65` | Buffer, `TextDecoder({stream:true})`, flush finale |
| Aggiornamento incrementale | ⚠️ | `components/chat/ChatWorkspace.tsx:216-223` | Un render per carattere; nessun `requestAnimationFrame` (grep: 0) |
| Errori durante lo streaming | ❌ | `components/chat/ChatWorkspace.tsx:235-265`; `utils/ndjson.ts:48-50` | Bug sul chunk `error` e righe malformate silenziose |
| Interruzione pulita | ✅ | `components/chat/ChatWorkspace.tsx:114-127` | |
| Loading chiari (login, upload, invio, storico) | ⚠️ | `components/auth/LoginForm.tsx:180-184`; `components/chat/ChatWorkspace.tsx:365` | Il loading dello storico non viene mai mostrato |
| Errori comprensibili | ⚠️ | `services/api-client.ts:22-42`, `components/chat/ChatWorkspace.tsx:286-287` | Testi del backend in inglese passati così come sono; messaggi con URL e status code |
| Layout conversazione + documenti + bbox | ✅ | `components/chat/ChatWorkspace.tsx:359-561`, `components/pdf/PdfFactCheckViewer.tsx:221` | Il viewer PDF è un modal a schermo intero che copre la conversazione (rivedibile) |
| Accessibilità / tastiera | ⚠️ | grep `aria-live`: 0; grep `Escape`: 0; `components/chat/RelatedDocumentsSection.tsx:66-69`, `components/chat/ChatWorkspace.tsx:464,477` | Card cliccabili realizzate come `<div onClick>`: non raggiungibili da tastiera |
| Uso backend: cookie | ⚠️ | `services/api-client.ts:60` | Vedi 1b |
| Uso backend: metodi, header, body | ⚠️ | `services/chat-service.ts:64-66,72` | Invia `chat_id` non documentato; `Accept` include `text/event-stream` |
| Lettura Swagger / schema | ⚠️ | `services/chat-service.ts:20-33,91-97`; `services/document-service.ts:14-28,88-92` | I normalizzatori ipotizzano forme di risposta inesistenti (`obj.chats`, `obj.items`, `obj.sessions`, `obj.files`) |

### Deliverable

| Deliverable | Stato | Evidenza | Nota |
|---|---|---|---|
| Codice sorgente | ✅ | `app/`, `components/`, `services/`, `utils/`, `types/` | |
| Script di avvio documentati | ⚠️ | `README.md:9-37` | Usa `npm install` mentre il lockfile è `bun.lock` |
| Dockerfile | ❌ | `ls Dockerfile` → assente | |
| docker-compose (opzionale) | ❌ | `ls docker-compose.yml` → assente | |
| README: avvio, decisioni, trade-off, limiti, "con più tempo" | ⚠️ | `README.md:1-170` | Sezioni presenti, ma il contenuto non corrisponde al codice: dichiara "Production-ready" (`README.md:3`) e chiede di modificare il CORS del backend (`README.md:56`), cosa fuori dal nostro controllo |
| Test automatici | ❌ | nessun file `*.test.*` / `*.spec.*`; nessun `vitest.config.*` / `playwright.config.*` | Non richiesti esplicitamente, ma necessari al quality gate |

## 4. Rischi tecnici (checklist richiesta)

| # | Rischio | Esito | Evidenza |
|---|---|---|---|
| R1 | `fetch` dentro i componenti | **Presente** (1 caso) | `components/settings/BackendConfigModal.tsx:53` |
| R2 | Assenza di `credentials: 'include'` o di un proxy same-origin | `credentials: 'include'` presente; **proxy assente**. Rischio CORS reale con Starlette ≤ 0.50 (sezione 2). | `services/api-client.ts:60,119`; `next.config.ts` senza `rewrites` |
| R3 | NDJSON senza gestione delle righe spezzate | **Gestito** | `utils/ndjson.ts:30-35,54-65` |
| R4 | Assenza di `AbortController` | **Presente e usato** | `components/chat/ChatWorkspace.tsx:55,190-191,114-127` |
| R5 | `dangerouslySetInnerHTML` / `rehype-raw` senza sanitize | Nessuno dei due è usato (grep: 0). L'HTML non viene renderizzato (requisito 3k ❌). La sanitizzazione è applicata nel punto sbagliato della pipeline. | `components/chat/MarkdownRenderer.tsx:16-23` |
| R6 | Conversione bbox in pollici | **Corretta** per origine top-left; espone un toggle inutile | `utils/coordinates.ts:39-46`; `components/pdf/PdfFactCheckViewer.tsx:375-376` |
| R7 | Uso di `any` | **Nessuno** (grep: 0); presenti cast `as` non verificati | `services/api-client.ts:83,85`; `utils/ndjson.ts:42` |
| R8 | Test mancanti | **Mancanti** | sezione Deliverable |
| R9 | Dockerfile mancante | **Mancante** | sezione Deliverable |
| R10 | README mancante | Presente ma **non accurato** | `README.md:3,56` |
| R11 (extra) | Override runtime dell'URL backend via `localStorage`, incompatibile con un proxy same-origin | Presente | `config/api.ts:9-27`, `components/settings/BackendConfigModal.tsx` |
| R12 (extra) | Dipendenze CDN a runtime per PDF.js | Presente | `components/pdf/PdfFactCheckViewer.tsx:98,103` |

## Assunzioni

1. **Schema OpenAPI**: generato dal sorgente (`app.openapi()`) e non scaricato da un backend in esecuzione. Coincide con `/openapi.json` finché il codice non cambia.
2. **Tipi di risposta**: OpenAPI non li descrive. `openapi-typescript` coprirà solo i tipi di request (`LoginRequest`, `ChatRequest`, multipart); i tipi di risposta vanno scritti a mano dalla sezione 2, con validazione runtime dove serve.
3. **Lunghezza massima `user_id` = 100**: ricavata da `BE:src/routes/auth.py:15`, non presente in OpenAPI.
4. **Comportamento CORS nel browser**: la combinazione `ACAO: *` + `credentials: 'include'` viene rifiutata secondo la spec Fetch. Non è stato verificato in un browser reale perché il backend non era in esecuzione. Quale Starlette finisca nell'immagine Docker dipende dalla data di build (`pip install fastapi` senza pin). Il proxy same-origin elimina la dipendenza.
5. **Streaming tramite il proxy di Next (`rewrites`)**: si presume che non bufferizzi `application/x-ndjson`. Se lo fa (ad esempio per la compressione), serve `compress: false` o un'alternativa: va verificato in P0-03.
6. **`rewrites` di Next non funzionano con `output: 'export'`**: per avere il proxy l'app resta "SPA" nel senso della specifica (tutto client-side) ma servita da `next start`/standalone, non come static export. Da formalizzare in un ADR.
7. **Package manager**: gli hook del quality gate invocano `npm run`. Si assume la migrazione a npm (`package-lock.json`) in P0-01, perché `bun` non è installato e l'immagine Node ufficiale include npm.
8. **Versione di Claude Code**: CLI 2.1.281 (`claude --version`); l'estensione VS Code che esegue questa sessione è 2.1.288 (percorso del processo). Gli hook in exec form (`command: "node"`) trovano `node` tramite il `PATH` del processo, che include nvm. La sintassi di hook e agenti è stata verificata sulla documentazione ufficiale. `stop_hook_active` **non è documentato** per `Stop`/`SubagentStop`: gli hook lo leggono se presente e usano comunque un contatore su file come anti-loop.
9. **`text_quote` placeholder**: il backend restituisce sempre la stessa frase (`BE:src/routes/chat.py:194`). La UI non può usarla per evidenziare testo reale nel PDF.
10. **Documenti globali**: tutti gli utenti vedono gli stessi documenti (`BE:src/routes/documents.py:120`). È un comportamento del backend e va dichiarato nel README.
