# 0001 — Proxy same-origin `/api` per la gestione del cookie di sessione

**Stato:** accettato

**Contesto**

Il backend FastAPI usa Starlette non pinnato (0.50.0 nell'ambiente verificato, vedi `docs/AUDIT.md` §2). Con questa versione il login cross-origin con credenziali riceve `Access-Control-Allow-Origin: *`, incompatibile con le richieste con credenziali; il cookie `user_id` è `SameSite=lax`.

Il frontend Next.js 15 risiede su `localhost:3000` e il backend su `localhost:8000`. Il browser rifiuta una risposta con credenziali se `Access-Control-Allow-Origin` è `*`, quindi l'autenticazione cross-origin risulta bloccata.

**Decisione**

Implementare un proxy same-origin con i `rewrites` di Next.js: il client chiama `/api/*` (same-origin), Next.js inoltra a `${BACKEND_URL}/api/*` come middleware del server. Il browser vede un'origin unica (`localhost:3000`), quindi il cookie viene gestito nativamente senza CORS.

Configurazione di `next.config.ts`:
```typescript
const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:8000';

const config: NextConfig = {
  rewrites: async () => [
    { source: '/api/:path*/', destination: `${BACKEND_URL}/api/:path*/` },
    { source: '/api/:path*', destination: `${BACKEND_URL}/api/:path*` }
  ],
  skipTrailingSlashRedirect: true,
  // ... resto della configurazione
};
```

**Motivo della doppia regola (con e senza trailing slash)**

Le route FastAPI terminano con slash (`/api/chat/`, `/api/documents/`). Con la sola regola `'/api/:path*'` la slash finale viene persa nel rewrite: il backend riceve `/api/chat` e risponde con un redirect 307 verso l'URL assoluto `http://localhost:8000/api/chat/`, che esce dal proxy (verificato con la sonda `.claude/reports/T007/probe-dev.txt`). Per questo la regola che preserva la slash è la prima. `skipTrailingSlashRedirect: true` impedisce inoltre a Next.js di reindirizzare `/api/chat/` a `/api/chat`.

Con la doppia regola (`/api/:path*/` e `/api/:path*`) e `skipTrailingSlashRedirect: true`, la slash viene preservata:
- `/api/chat/` → regola `'/api/:path*/'` → `${BACKEND_URL}/api/chat/`
- `/api/chat` (senza slash) → regola `'/api/:path*'` → `${BACKEND_URL}/api/chat`

Verifica: `.claude/reports/T007/probe-chat-slash.txt` (POST `/api/chat/` via proxy: 200 NDJSON, nessun 307).

**Comportamento del client**

Il client (`services/api-client.ts`) chiama sempre URL relativi:
Le funzioni `request` e `rawRequest` costruiscono l'URL con `toApiUrl(endpoint)` (solo percorsi relativi `/api/...`) e chiamano `fetch` con `credentials: 'same-origin'`.

Ogni chiamata a `/api/chat/` viene automaticamente riscritta dal proxy a `http://localhost:8000/api/chat/`. Il cookie `user_id` viaggia nello header `Cookie` ed è gestito dal browser.

**Ambiente di produzione (Docker)**

`next.config.ts` imposta `output: 'standalone'`. Il `Dockerfile` del frontend **non esiste ancora** (P0-07, todo): quanto segue è la configurazione prevista, non implementata. I `rewrites` sono valutati a **build time**; `BACKEND_URL` andrà passata come build arg:

```dockerfile
ARG BACKEND_URL=http://localhost:8000
ENV BACKEND_URL=${BACKEND_URL}
RUN npm run build  # BACKEND_URL è serializzato nei rewrites del routes-manifest
```

Alla runtime, `docker run -e BACKEND_URL=...` **non** modifica il proxy: i rewrites rimangono fissi al valore di build time. Questo è un vincolo di Next.js (il proxy è generato durante la compilazione).

Per un URL variabile a runtime servirebbe un route handler esplicito, oppure build args nel `docker-compose.yml`.

Alternativa non scelta: `output: 'export'` produce un'SPA statica esportata in `out/`, incompatibile con i `rewrites` (funzionano solo con server Next.js: `next start` o `standalone`).

**Alternative considerate e scartate**

1. **CORS diretto con CORSMiddleware sul backend**
   - Richiede di modificare il backend, fuori dallo scope del test frontend.

2. **Route handler proxy esplicito** (`src/app/api/[...proxy]/route.ts`)
   - Funciona ma aggiunge complessità e verbosità rispetto ai `rewrites`.
   - Mantiene il medesimo vincolo: URL reale del backend fisso a build time.

3. **`trailingSlash: true` globale**
   - Forza una slash su tutte le route del frontend, rompendo endpoint senza slash (es. `/api/documents` per la lista).
   - Non è una soluzione generale.

4. **Static export (`output: 'export'`)**
   - Incompatibile con i `rewrites` (non ci sono route server).
   - Obbligherebbe il frontend ad essere servito da un proxy esterno (nginx, Vercel Serverless Functions), fuori dalla specifica.

**Conseguenze**

✅ **Vantaggi**
- Il browser gestisce il cookie come same-origin, senza CORS.
- Il client è semplice: niente configurazione runtime, niente gestione di credenziali via token/localStorage.
- Funziona in sviluppo (`npm run dev`) e in produzione (`next build && next start` oppure `standalone`).
- E2E: nessun errore di console, streaming NDJSON non bufferizzato (`.claude/reports/T007/e2e-real-backend.md`, scenari pass).

⚠️ **Vincoli**
- URL del backend è fisso a build time: dev, staging, prod richiedono build separate.
- In Docker (P0-07, non ancora implementato) la variabilità dell'URL richiederà build args.
- Non permette override runtime dell'URL (il modal di configurazione è stato rimosso in P1-11).

**Test e evidenze**

- Unit test: `tests/unit/api-client.test.ts` verifica che ogni `fetch` riceva un URL relativo (nessun `localhost:8000` nel client).
- E2E: `e2e/proxy-cookie.spec.ts` (login, cookie impostato, GET documenti 200); `e2e/proxy-streaming.spec.ts` (chat streaming senza buffering).
- Probe: `.claude/reports/T007/probe-dev.txt`, `probe-prod.txt`, `probe-chat-slash.txt` (POST `/api/chat/` → 200 NDJSON, nessun 307).
- Esplorazione: `.claude/reports/T007/explore-output.txt` (console log senza errori CORS; due messaggi inviati alle API).
