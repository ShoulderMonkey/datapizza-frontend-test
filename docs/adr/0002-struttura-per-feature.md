# 0002 — Struttura per feature e livello API unico

**Stato:** accettato

**Contesto**

Il codice era organizzato per tipo di file: `components/`, `services/`, `types/`, `utils/`. Questo modello ha due conseguenze negative:
- **Accoppiamento**: file non correlati finiscono nella stessa cartella, rendendo difficile capire i confini di una feature.
- **Componenti monolitici**: `ChatWorkspace.tsx` (559 righe) mescolava layout, orchestrazione dello stato, parsing dello stream NDJSON e chiamate HTTP.

I servizi API (`api-client.ts`, `auth-service.ts`, `document-service.ts`, `chat-service.ts`) erano sparse e importavano dai tipi globali. Gli errori HTTP erano rappresentati da una sola classe `ApiClientError { statusCode, isNetworkError }`, insufficiente per distinguere errori di rete, abort, 4xx strutturati, 5xx e fallimenti di parsing dello stream. Inoltre, gli AbortError venivano rilanciati grezzi al componente, senza normalizzazione.

La specifica valuta "Struttura del progetto React" e "Separazione tra logica di chiamata API e componenti UI".

**Decisione**

Adottare una struttura per feature in `src/features/`, con un livello API centralizzato in `src/api/` e errori normalizzati.

**1. Struttura per feature**

```
src/features/
├── auth/
│   ├── components/          # LoginForm
│   ├── hooks/               # useLogin, useSession
│   ├── lib/                 # Funzioni pure (session-storage, ecc.)
│   └── types.ts             # Tipi UI della feature + re-export dei tipi wire
├── documents/
│   ├── components/          # DocumentListModal, DocumentUploadDropzone
│   ├── hooks/               # useDocumentUpload, useDocuments
│   └── types.ts             # Tipi della feature
├── chat/
│   ├── components/          # ChatWorkspace (133 righe), ChatComposer, ChatMessageItem, ecc.
│   ├── hooks/               # useChatStream (183 righe), useAutoScroll
│   └── types.ts             # ChatMessage, StreamChunk, types UI
├── factcheck/
│   ├── components/          # PdfFactCheckViewer, BoundingBoxOverlay, RelatedDocumentsSection
│   ├── hooks/               # usePdfDocument, usePdfViewer
│   ├── lib/                 # coordinates.ts (coordinate inch-to-pixel)
│   └── types.ts             # RectInches, BoundingRegion, types citazioni
├── history/
│   ├── components/          # ChatSidebar
│   ├── hooks/               # useChatHistory
│   └── types.ts             # Tipi storico
└── (aggiunta) src/components/ui/
    ├── MarkdownRenderer.tsx # Rendering Markdown + HTML (rehype-sanitize)
    └── Spinner.tsx          # Indicatore di caricamento
```

Ogni feature ha:
- **`components/`**: componenti presentazionali (ricevono `props` e `callbacks`, nessuna chiamata API diretta).
- **`hooks/`**: custom hooks che orchestrano lo stato, chiamano il livello API e gestiscono effetti.
- **`types.ts`**: tipi della feature e re-export dei tipi wire (`Document`, `ChatMessage`, ecc.) dal livello API.
- **`lib/`** (opzionale): funzioni pure senza React (esempi: `auth/lib/session-storage.ts`, `factcheck/lib/coordinates.ts`).

Nessuna feature importa da altre features (salvo per tipi e componenti UI condivisi); il coordinamento avviene nel componente radice `app/page.tsx` oppure tramite un hook centralizzato.

**2. Componenti UI generici**

`src/components/ui/` contiene componenti presentazionali non specifici di una feature:
- `MarkdownRenderer.tsx` (pipeline `react-markdown` + `remark-gfm` + `rehype-raw` + `rehype-sanitize`, per uso dalla feature chat).
- `Spinner.tsx` (indicatore di caricamento generico).

Questi componenti non importano da `src/api` e non hanno callback che dipendono da stato globale.

**3. Livello API centralizzato**

`src/api/` è l'**unico luogo** dove compare `fetch`:

```
src/api/
├── client.ts        # request, requestRaw, requestStream (unico punto fetch)
├── errors.ts        # Definizione di ApiError, normalizzazione errori
├── ndjson.ts        # Parser NDJSON robusto
├── types.ts         # Tipi wire (Document, ChatMessage, ecc.)
├── auth.ts          # Funzioni login, logout
├── documents.ts     # GET /api/documents/, POST /api/documents/ (multipart)
├── chat.ts          # GET /api/chat/, POST /api/chat/ (streaming)
└── index.ts         # Barrel export
```

Caratteristiche del client:
- **URL relativi**: `request('/api/auth/login', ...)` → il proxy `/api/:path*` li manda al backend.
- **`credentials: 'same-origin'`**: il browser allega il cookie `user_id` automaticamente.
- **Unico `fetch`**: verificato con ESLint (vedi sotto).

Le funzioni di servizio (`auth.ts`, `documents.ts`, `chat.ts`) chiamano `request`, `requestRaw` o `requestStream` e restituiscono i dati o lanciano `ApiError`.

`src/api/` non importa mai da `src/features`.

**4. Normalizzazione degli errori**

Ogni errore HTTP e di rete diventa un `ApiError`:

```typescript
class ApiError extends Error {
  status: number | null;  // HTTP status (null per errori di rete)
  code: ApiErrorCode;     // network | aborted | bad_request | ... | unknown
  userMessage: string;    // Messaggio italiano pronto per il UI
  cause: unknown;         // Dettaglio tecnico (status, response body, ecc.)
  detail: unknown;        // Per 4xx/5xx: detail dal backend (stringa, array o oggetto)
  endpoint?: string;      // Per debug
}
```

Mappa `code` (enum `ApiErrorCode`):
- `network`: Errore di rete (fetch fallisce).
- `aborted`: Stream interrotto da `AbortController.abort()`.
- `bad_request`: HTTP 400 (detail stringa o array).
- `unauthorized`: HTTP 401.
- `forbidden`: HTTP 403.
- `not_found`: HTTP 404.
- `validation`: HTTP 422 (detail array [{ loc, msg }]).
- `server`: HTTP 5xx.
- `http`: Altro HTTP error non mappato.
- `invalid_response`: Risposta non JSON/malformata prima dello stream.
- `stream_parse`: Riga NDJSON non valida durante lo stream.
- `client_validation`: Errore di validazione lato client (user_id formato, ecc.).
- `unknown`: Non classificato.

Funzioni di utilità:
- `apiErrorFromHttp(response, endpoint)`: converte una risposta HTTP in `ApiError`.
- `toApiError(err, endpoint)`: converte qualunque errore in `ApiError`.
- `isAbortError(err)`: controlla se `err.code === 'aborted'`.
- `extractDetail(body)`: estrae il campo `detail` dalla risposta.

La mappa `DEFAULT_USER_MESSAGES` associa ogni `code` a un messaggio italiano.

**5. Vincolo verificabile: regola ESLint su `fetch`**

In `eslint.config.mjs:24-35`:

```javascript
{
  rules: {
    'no-restricted-globals': ['error', { name: 'fetch', message: 'Use src/api instead' }],
    'no-restricted-properties': [
      'error',
      { object: 'window', property: 'fetch', message: 'Use src/api instead' },
      { object: 'globalThis', property: 'fetch', message: 'Use src/api instead' },
      { object: 'self', property: 'fetch', message: 'Use src/api instead' }
    ]
  }
},
// Deroghe per test, mocks, e2e (eslint.config.mjs:37-55)
{
  files: ['tests/**', 'e2e/**', 'src/mocks/**', 'src/test/**', '**/*.test.*', '**/*.spec.*', 'vitest.setup.*', 'playwright.config.*'],
  rules: { 'no-restricted-globals': 'off', 'no-restricted-properties': 'off' }
}
```

`npm run lint` fallisce se `fetch`, `window.fetch` o `globalThis.fetch` comparano in `src/features/`, `src/components/`, `app/`, ecc.

Coperto da `tests/unit/eslint-no-fetch.test.ts`: verifica che le tre forme di `fetch` (globale, `window.fetch`, `globalThis.fetch`) producano un errore `no-restricted-globals` o `no-restricted-properties` in `src/features/chat/x.tsx` e `app/x.tsx`, e nessun errore in `src/api/x.ts`.

**6. Alias e import**

Restano `tsconfig.json` e `vitest.config.ts`: `@/*` → `./*` (dalla root). Gli import quindi sono:
- `import { ChatWorkspace } from '@/src/features/chat/components/ChatWorkspace';`
- `import { request } from '@/src/api/client';`
- `import { MarkdownRenderer } from '@/src/components/ui/MarkdownRenderer';`

`app/` rimane nella root (App Router di Next.js).

**7. Grafo delle dipendenze ammesse**

```
app/page.tsx, app/layout.tsx
  ↓
src/features/{auth,documents,chat,factcheck,history}/hooks
  ↓
src/features/{auth,documents,chat,factcheck,history}/components
src/features/{auth,documents,chat,factcheck,history}/types
  ↓
src/components/ui/
  ↓
src/api/
```

**Regole:**
- `app/` importa da `src/features/**` e `src/api/`.
- Una feature può importare componenti, hook o tipi di un'altra feature (es. chat compone documents, factcheck, history per mostrare citazioni, PDF, storico).
- Feature può importare `src/api/` (per tipi, nella definizione dei tipi del dato).
- `src/api/` non importa da feature.
- `src/components/ui/` non importa da `src/api/` né da feature (se necessita dati, riceve props).

**Conseguenze e benefici**

1. **Separazione di responsabilità**: componenti presentazionali (UI), logica (hooks), trasporto (API), dati (types).
2. **Testabilità**: hooks senza componenti, funzioni API deterministiche. `useChatStream` attualmente usa `useState`; P1-03 lo porterà a `useReducer` con batching `requestAnimationFrame`.
3. **Scalabilità**: aggiungere una nuova feature (es. `feedback/`) richiede una nuova cartella, non cambiar file esistenti.
4. **Errori normalizzati**: l'UI mostra sempre `error.userMessage` italiano, i dettagli tecnici vanno in `console.error(error.cause)`.
5. **ChatWorkspace da 559 a 133 righe**: la logica di stream e completamento è in `useChatStream` (183 righe).
6. **Eliminazione di fetch accidentali**: ESLint impedisce chiamate API fuori da `src/api/`, riducendo il bug report e facilitando audit di sicurezza.

**Alternative considerate e scartate**

1. **Struttura per tipo (status quo)**: componenti, servizi, tipi e utility in cartelle piatte. Nega visibilità dei confini e accoppia file logicamente non correlati.
2. **Un modulo `services/` separato da `src/api/`**: due livelli per la stessa responsabilità (gestione HTTP). Consolidare in `src/api/` è più diretto e previene confusione.
3. **Spostare `app/` in `src/app/`**: richiederebbe di aggiornare `tsconfig.json` e `vitest.config.ts`. Non aggiunge valore (il percorso relativo da root rimane breve).

**Test e evidenze**

- Unit test (`tests/unit/api-errors.test.ts`): normalizzazione di errori di rete (status null, code network), 400 con detail stringa, 422 con detail array, abort (already-aborted e delayed).
- Unit test (`tests/unit/eslint-no-fetch.test.ts`): le tre forme di `fetch` (globale, `window.fetch`, `globalThis.fetch`) producono errore `no-restricted-globals`/`no-restricted-properties` in `src/features/chat/x.tsx` e `app/x.tsx`, nessun errore in `src/api/x.ts`.
- Integration test (`tests/integration/ChatWorkspace.stream-errors.test.tsx`): stream con chunk `error`, riga malformata non-JSON, chunk con type sconosciuto. Testo parziale conservato in stato `error`.

Files chiave:
- `src/api/errors.ts:77` — definizione `ApiError`.
- `src/api/client.ts:48` — unico `fetch`.
- `eslint.config.mjs:24-55` — regole no-restricted-globals e deroghe.
- `src/features/chat/components/ChatWorkspace.tsx` (133 righe) (scesa da 559).
- `src/features/chat/hooks/useChatStream.ts` (183 righe) — hook stream con `useState` (useReducer in P1-03).
- `tests/unit/api-errors.test.ts` — contratto ApiError.
- `tests/unit/eslint-no-fetch.test.ts` — validazione regola ESLint.
