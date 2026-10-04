# Changelog

Tutti i cambiamenti rilevanti sono documentati in questo file.

Formato: [Keep a Changelog](https://keepachangelog.com/it/1.1.0/).

---

## [Unreleased]

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

---

## Note versioning

Lo stato di ciascun item della roadmap (`P0-01`, `P0-02`, ..., `P1-11`) è gestito in `docs/ROADMAP.md` da `documentation-writer`.
