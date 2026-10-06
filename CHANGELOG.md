# Changelog

Tutti i cambiamenti rilevanti sono documentati in questo file.

Formato: [Keep a Changelog](https://keepachangelog.com/it/1.1.0/).

---

## [Unreleased]

### Fixed (T057, P1-22)
- Identità coerente tra tab: `subscribeToStoredUserId` in `src/features/auth/lib/session-storage.ts` ascolta l'evento `storage` sulla chiave `docfact_auth_user_id` (`key === null` = `localStorage.clear` = logout), con cleanup; `AUTH_USER_KEY` è ora esportata.
- `useSession.ts`: logout in un'altra tab → anonymous con avviso `signed_out_elsewhere` ("Sei uscito da un'altra scheda. Accedi di nuovo.", `src/api/errorMessages.ts`); utente diverso → `resetUnauthorizedGuard` e nuovo `userId` authenticated; stesso utente → nessun effetto.
- `app/page.tsx`: `<QueryProvider key={userId}>` rimonta cache e `ChatWorkspace` al cambio utente, quindi storico e documenti vengono ricaricati.
- Test: `tests/integration/p1-22-cross-tab-session.test.tsx` (prima del fix 2 failed su 2, exit 1; dopo exit 0) ed `e2e/p1-22-multitab.spec.ts` (2 test). Gate typecheck, lint, test exit 0 (49 file, 310 test).
- e2e: `npm run e2e` 50 passed. Senza reload: x1=0, x2=1, conversazione di x1 non visibile, storico 0 voci, nuova domanda → `GET /api/chat/` 200 con user_id x2; logout in un'altra tab → login con avviso; login/logout nella stessa pagina invariati.
- Docs: `docs/ROADMAP.md` P1-22 aggiornato a `done` (T057); resta aperto solo P2-14.

### Fixed (T056, P1-21)
- Orari dello storico nel fuso locale: il backend restituisce `created_at` in UTC senza offset (es. `2026-10-06T13:03:46.422580`) e `new Date()` lo leggeva come ora locale (in Europe/Rome indietro di 2 ore). Nuova funzione condivisa `parseApiDate` in `src/api/dates.ts`: aggiunge `Z` ai timestamp ISO senza offset, lascia invariati quelli con `Z` o `±HH:MM`/`±HHMM`, stringhe invalide → NaN.
- `ChatSidebar.tsx` (`formatEntryDate` e `<time dateTime>`), `ChatMessageItem.tsx`, `useChatList.ts` (ordinamento) e `findSavedChatId.ts` usano `parseApiDate`. Grep `new Date(` / `Date.parse` in `src`: restano solo `useChatStream.ts:131,138` (`new Date().toISOString()`, messaggi live) e `src/api/dates.ts:10-11`.
- Test: `tests/unit/parse-api-date.test.ts` e `tests/integration/p1-21-history-timezone.test.tsx`; `vitest.config.ts` fissa `process.env.TZ = 'Europe/Rome'`. Prima del fix 6 failed | 1 passed (sidebar e messaggi 13:03 invece di 15:03), dopo il fix exit 0. Gate typecheck, lint, test exit 0 (48 file, 307 test).
- e2e: 48 passed. In Europe/Rome storico 15:45 con `<time dateTime>` `2026-10-06T13:45:09.921Z`; in America/New_York sidebar 6 ott, 09:45 e messaggi 09:45 per lo stesso istante.
- Docs: `docs/ROADMAP.md` P1-21 aggiornato a `done` (T056); restano aperti P1-22 e P2-14.

### Changed (T055, P1-20)
- Messaggi dell'utente resi come testo letterale: no Markdown, no HTML inline, no `MarkdownRenderer`. Ramo `isUser` in `ChatMessageItem.tsx:80-87` mostra `<p className="whitespace-pre-wrap break-words ...">{message.content}</p>` con a-capo preservati e parole lunghe spezzate senza overflow orizzontale.
- Input pericolosi (`<img src=x onerror=alert>`, `**bold**`, `[link](javascript:...)`) sono resi come testo letterale: nessun elemento `img`, `strong`, `a` o attributi nel DOM (img=0, strong=0, a=0), il testo visibile coincide all'input.
- Risposte dell'assistente continuano a usare `MarkdownRenderer` con sanitizzazione (`rehype-raw` + `rehype-sanitize`); test 3 di `tests/integration/p1-20-user-message-literal.test.tsx` (lato assistente: `strong` presente, nessun `script` né `onerror` su `img`) e `npm run test` 46 file, 300 test exit 0.
- Test: `tests/integration/p1-20-user-message-literal.test.tsx` (3 passed su 300 test complessivi); e2e: 48 passed con messaggi utente e assistente verificati (tester: white-space pre-wrap su 375 e 1280 px, no overflow; letterale con img/strong/a=0; assistente con H3/P/UL/LI/STRONG, citazioni funzionanti).
- Gate typecheck, lint, test exit 0.

### Changed (T050, P1-19)
- Sottotitolo del login: testo semplice in italiano "Fai domande sui tuoi PDF e verifica le risposte sulle fonti." (`src/features/auth/components/LoginForm.tsx:52`), senza i riferimenti a "grounded" e "streaming NDJSON".
- Test: `tests/integration/p1-19-login-subtitle.test.tsx` (2 test) verifica il testo atteso e l'assenza di ndjson/streaming/grounded; gate typecheck, lint, test exit 0 (45 file, 297 test). e2e: sottoinsieme smoke, session, a11y, dark-theme 11 passed; `npm run e2e` completo 48 passed.
- Docs: `docs/ROADMAP.md` P1-19 aggiornato a `done` (T050), stato a T050. Nota: `app/layout.tsx:6,9,15` contiene ancora "NDJSON" nel metadata description, fuori perimetro.

### Docs (T049)
- `docs/ROADMAP.md`: nuovo item P1-19 `todo` di UX e microcopy (login: sottotitolo senza dettagli implementativi) con stima XS e dipendenza P1-17. Nota di P1-17 aggiornata per puntare a P1-19. Nota: `app/layout.tsx:6,9,15` contiene ancora "NDJSON" nel metadata description, fuori dal perimetro della richiesta. Stato attuale aggiornato a T049.

### Docs (T044)
- `docs/ROADMAP.md`: aggiunti tre nuovi item `todo` di UX e microcopy: P1-16 (hint del composer senza dettagli implementativi NDJSON) e P1-17 (empty state della nuova chat con testi placeholder semplici, senza riferimenti alla specifica) con stima P1-16: XS e P1-17: S, dipendenza P1-15 per entrambi; P1-18 (sidebar collassata: un solo bottone per riaprirla) con stima XS e dipendenza P1-13, per evitare il duplicato del bottone "Espandi barra laterale" nella topbar a viewport ≥ 768 px. Nota: `src/features/auth/components/LoginForm.tsx:52` e `app/layout.tsx:6,9,15` contengono ancora riferimenti a "NDJSON" e metadata, fuori dal perimetro della richiesta.

### Changed (T047, P1-18)
- Bottone "Espandi barra laterale" della topbar: nascosto a viewport ≥ 768 px con classe Tailwind `md:hidden` (breakpoint di viewport, non container query), lasciando visibile il solo bottone del rail collassato. A < 768 px il bottone resta visibile e accessibile per mobile. Test: `e2e/sidebar-single-expand.spec.ts` (4 test a 1280, 768 e 375 px); run con keyboard, focus, layout e responsive 18 passed; 7 spec mirati (incl. dark-theme e a11y) 26 passed; gate typecheck, lint, test exit 0 (295 test).
- Finding (low, non bloccante): il focus ring del bottone topbar non è visibile dopo focus() programmatico su mobile; l'attivazione da tastiera è funzionante e coperta dall'e2e.
- Docs: `docs/ROADMAP.md` P1-18 aggiornato a `done` (T047), tabella dei criteri aggiornata con P1-16, P1-17, P1-18.

### Changed (T046, P1-17)
- WelcomePanel: testi placeholder semplici in italiano senza riferimenti alla specifica o dettagli implementativi. Sottotitolo: "Fai una domanda sui tuoi documenti PDF: le risposte riportano le fonti e mostrano il punto esatto nel documento." (righe 24). Card 1: "Carica i PDF su cui vuoi fare domande." (riga 39). Card 3: "Controlla le fonti" / "Apri una citazione per vedere il passaggio evidenziato nella pagina del PDF." (righe 60, 63), `<code>` rimosso.
- Test: `tests/integration/p1-17-welcome-panel.test.tsx` verifica che non compaia gergo tecnico (ndjson, multipart, form-data, bounding, rects_in, streaming); suite completa con gate typecheck, lint, test exit 0 (295 test). e2e `dark-theme.spec.ts` verde con 0 violazioni color-contrast.
- Docs: `docs/ROADMAP.md` aggiornato, P1-17 `done` (T046), stato a T046, finding low sulla card 2 rinviato.

### Changed (T045, P1-16)
- Hint del composer: testo ridotto a sole scorciatoie "Invio per inviare, Shift+Invio per a capo." (rimossi dettagli implementativi NDJSON e bounding region) (`src/features/chat/components/ChatComposer.tsx:166-168`).
- Test: `tests/integration/p1-16-composer-hint.test.tsx`; suite completa con gate typecheck, lint, test exit 0.

### Added (T043, P2-13)
- Viewer PDF a scroll continuo con rendering lazy: pagine in colonna con segnaposto a misura esatta (`usePdfPageSizes.ts`, `PdfPageSlot.tsx`, `lib/pageLayout.ts`), disegnate solo entro un'altezza del contenitore sopra e sotto la vista; pagina corrente sotto il centro del contenitore; navigazione alle citazioni anche su pagine lontane, zoom che mantiene il punto al centro, proxy pdf.js condiviso con le thumbnail.
- Text layer attivo (testo selezionabile e copiabile), box sopra di esso con `pointer-events` solo sui box; annotation layer spento.
- Test: `tests/unit/pageLayout.test.ts`, `e2e/pdf-continuous.spec.ts`; `e2e/pdf-viewer.spec.ts` e `e2e/layout.spec.ts` verificano il bbox attivo. Rossi su 2de9f20 (3 failed); dopo: suite e2e 44 passed, `--repeat-each=5` 40 passed.
- ADR `docs/adr/0008-viewer-scroll-continuo.md`. P2-13 `done`: tutti gli item P0/P1/P2 sono `done`.
- Finding aperto (low): nome file nell'header del viewer troncato a 1 carattere a 1280 px (effetto di T040), rinviato.

### Fixed (T042, P2-12)
- `npm run start` avvia il server standalone (`node .next/standalone/server.js`, `package.json:10`) senza l'avviso di `next start`; `postbuild` (`scripts/copy-standalone-assets.mjs`) copia `.next/static` e `public` nello standalone. Verificato: `/`, CSS, `/icon.svg` e login 200.
- e2e: `user_id` univoci per run (`e2e/helpers/user.ts`, `uniqueUser`) al posto di costanti fisse, per non accumulare dati sullo stesso utente. Suite completa 41 passed. La race del filechooser in `e2e/keyboard.spec.ts` era già risolta da T027: `--repeat-each=20 --workers=1` 20/20.

### Changed (T042)
- README: avvio di produzione con `npm run build` e `npm run start` (nota sull'avviso rimossa); documentati i dati che gli e2e lasciano sul backend (DB in memoria, nessun endpoint di cancellazione). P2-12 `done`.

### Fixed (T041, P2-11)
- Proxy: `/api/documents` e `/api/chat` senza slash finale sono riscritte verso `${BACKEND_URL}/api/<x>/` (`next.config.ts:21-22`); prima FastAPI rispondeva 307 con `Location` assoluta verso l'host del backend. Dopo: nessuna `Location`, 401 senza cookie e 200 con cookie, POST `/api/chat` 200 NDJSON.
- Console del primo load vuota: aggiunta l'icona `app/icon.svg` (marchio "DF"); l'errore era il 404 di `/favicon.ico`.

### Added (T041, P2-11)
- Test: `e2e/hygiene.spec.ts` (icona 200, console pulita su login e home, nessun redirect verso il backend, al massimo 1 richiesta per la prima pagina di storico e documenti in produzione, 2 in dev per StrictMode). Rossi su f250901 (5 failed).
- `playwright.config.ts`: `PLAYWRIGHT_BASE_URL` punta la suite a un server già avviato (ad esempio una build di produzione) e disattiva il `webServer`; default invariato.
- ADR 0001 aggiornato con le regole delle collezioni.

### Fixed (T040, P2-09)
- Spec `e2e/pdf-viewer-overflow.spec.ts` instabile dopo T038 (bisect 10 ripetizioni: 10/10 prima di T038, 9/10 su 0a60755, 7/10 su e6d79c4). Causa: misura durante lo smooth scroll di `PdfPageView.tsx`; la toolbar `flex-wrap` di T038 portava l'header su due righe e riduceva il container "Pagina PDF" da 340 a 310 px a 1280x720.
- Spec: `expect.poll` sullo `scrollTop` stabile per 3 campioni a 100 ms prima di misurare, asserzioni di contenimento invariate.
- Viewer: header con container query e toolbar su una sola riga (`PdfFactCheckViewer.tsx`), container "Pagina PDF" a 396 px a 1280x720; "Chiudi visualizzatore" resta nel viewport a 1024 px. Dopo: overflow x20 con 20 passed, suite e2e 36 passed.

### Changed (T040)
- ESLint ignora `.claude/**` (`eslint.config.mjs`): un file di probe in `.claude/reports` faceva fallire `eslint .`.

### Fixed (T039, P2-10)
- Hover in tema scuro con variazione visibile: `dark:hover:text-indigo-200` al posto di un valore uguale alla base `dark:text-indigo-300` nel pulsante "Aggiorna" (`DocumentListModal.tsx:174`) e nei link Markdown (`MarkdownRenderer.tsx:98`).
- Contrasti in tema scuro: testo secondario della sidebar `text-slate-500` -> `text-slate-400` (`ChatSidebar.tsx`) e `code` con `dark:bg-slate-700 dark:text-slate-100` nel pannello di upload (`DocumentUploadDropzone.tsx:130`) e nel `WelcomePanel.tsx:63`; in chiaro il `code` usa `bg-slate-200 text-slate-700` (contrasto 3.86:1 corretto).

### Added (T039, P2-10)
- Test: `tests/unit/dark-hover.test.ts` (nessun `dark:hover:<utility>` uguale al `dark:<utility>` di base sullo stesso elemento; non vede classi calcolate a runtime) e due scenari in `e2e/dark-theme.spec.ts` (errore di upload e upload in corso, 0 violazioni axe `color-contrast`); gate exit 0.

### Added (T038, P2-09)
- Thumbnail delle citazioni: pagina adattata al box fisso 140x180 con scala `min(140/pageW, 180/pageH)`, centrata, con i rect alla stessa scala (`CitationThumbnailPage.tsx`); le pagine orizzontali non sono più tagliate.
- Proxy pdf.js condiviso per documento (`useDocumentProxy.ts`, `queryKeys.documents.proxy`): un solo parse per documento, le card usano `<Page pdf={proxy}>`; il proxy viene distrutto su refetch e rimozione dalla cache. Il viewer fa ancora il proprio parse.
- Test: `tests/integration/CitationThumbnail.p2-09.test.tsx`, `e2e/related-1024.spec.ts` (rossi su a54a285); gate exit 0 (278 test), e2e 34 passed.

### Changed (T038, P2-09)
- `RelatedDocumentsSection.tsx` e `ChatHeader.tsx` usano container query (`@container`): card a una o due colonne e thumbnail sopra o accanto alla citazione in base alla larghezza.
- Toolbar del viewer con `flex-wrap` e `min-w-0` (`PdfFactCheckViewer.tsx`).

### Fixed (T038, P2-09)
- Dopo un upload viene invalidata solo `queryKeys.documents.list()` (prima `documents.all`, che causava ri-download e ri-parse dei PDF in cache; `useDocumentUpload.ts`).
- Nome accessibile "Libreria PDF" sempre presente nell'header (testo `sr-only` sotto `@md`), senza sovrapposizione al titolo a 1024 px (`ChatHeader.tsx`).
- A 1024 px con sidebar e viewer aperti: card dei documenti correlati non più sovrapposte e "Chiudi visualizzatore" dentro il viewport.

### Fixed (T037, P2-08)
- Citazioni identiche attivate insieme: il backend restituisce lo stesso `text_quote` placeholder per tutte, quindi l'uguaglianza strutturale evidenziava tutte le citazioni dello stesso documento e pagina. Ora identità per occorrenza con `occurrence_key` lato client (`src/api/types.ts`, `chatStreamReducer.ts`, `src/api/chat.ts`), confrontata da `isSameCitation` (`citations.ts`) con fallback strutturale; usata in `BoundingBoxOverlay.tsx` e nel `syncKey` di `PdfFactCheckViewer.tsx`.
- Scroll della lista CITAZIONI più robusto all'apertura di un secondo documento (subito, dopo 2 rAF e con `ResizeObserver` per 600 ms; solo `list.scrollTop`).
- Test: unit `citations`, `chatStreamReducer`, `chat-get`, integration `citation-highlight` (4 rossi su 0fc49db, verdi dopo; 275 test), `e2e/citation-occurrence.spec.ts` (passa anche su 0fc49db: guardia, non riproduce il residuo di T023); e2e completa 32 passed.

### Added (T036, P1-15)
- Composer: limite di 10000 caratteri lato client (`QUERY_MAX_LENGTH` in `src/api/chat.ts`, fonte backend), contatore "N/10000 caratteri" oltre 9000, messaggio in italiano con `role="alert"`, "Invia" disabilitato e nessuna richiesta oltre il limite (`ChatComposer.tsx`).
- Upload: messaggio di successo persistente con `role="status"` nel tab lista (`DocumentListModal.tsx`, `DocumentUploadDropzone.tsx`).
- Test: `tests/unit/no-english-boxes.test.ts`, `tests/integration/p1-15-microcopy.test.tsx` (7 test rossi su 1421d3a, verdi dopo); gate exit 0 (271 test), e2e 31 passed.

### Changed (T036, P1-15)
- Lista CITAZIONI: "N boxes" diventa "N box" (`PdfFactCheckViewer.tsx:479`); la modale documenti mostra "Caricamento…" invece di "0 file" durante il fetch.

### Fixed (T035, P1-13)
- Bbox vicina al margine sinistro non raggiungibile nel layout affiancato. Causa: container `justify-center` con overflow non scrollabile a sinistra; il pannello era stato ristretto da 589 a 512 px in T033, rendendo visibile il difetto.
- Fix: container senza `justify-center` (`PdfFactCheckViewer.tsx:338`) e wrapper della pagina `my-auto mx-auto shrink-0` (`PdfPageView.tsx:63`).
- Test: `e2e/pdf-viewer-overflow.spec.ts` (rosso su eec31bd, verde dopo il fix); `pdf-viewer.spec` x20 exit 0 (prima 5/50 fail su 2d211e3); suite completa 31 passed.

### Added (T034, P1-14)
- Voce salvata marcata con `aria-current` a fine stream riuscito, senza selezionarla, e annuncio `role="status"` "Conversazione salvata nello storico" (`useSavedChat.ts`, `findSavedChatId.ts`, `HistorySavedStatus.tsx`, `ChatWorkspace.tsx`, `ChatSidebar.tsx`, `useChatList.ts`, `useChatStream.ts`).
- Contesto della voce precedente in un gruppo etichettato "Dalla conversazione precedente" (`ChatConversation.tsx`).
- Test: `tests/unit/findSavedChatId.test.ts`, `tests/integration/history-saved-p1-14.test.tsx`, `e2e/history.spec.ts` (history x3 exit 0; tester 10 passed).

### Changed (T034, P1-14)
- ADR 0004 punto 5 modificato: la nuova voce non è più "non selezionata" ma marcata (`docs/adr/0007-feedback-storico.md`); `tests/integration/history-model.test.tsx` aggiornato.
- Limite noto: con più di 20 chat la nuova voce può essere oltre le pagine caricate e non viene marcata (l'annuncio resta).

### Docs (T034)
- `docs/ROADMAP.md`: P1-14 `done`; README §5, §7 e §8 aggiornati.

### Added (T033, P1-13)
- Fit-to-width automatico della pagina PDF nel drawer sotto 1024 px (`PdfFactCheckViewer.tsx`, `FactCheckPanel.tsx`) e larghezza minima della conversazione di 480 px a ≥ xl (`ChatWorkspace.tsx`).
- Test: `e2e/responsive.spec.ts` (suite completa 30 passed; responsive x3 15 passed).

### Fixed (T033, P1-13)
- Nessuno scroll orizzontale a 390 e 768 px (canvas 354 e 716 px); conversazione 490 px a 1440 px con sidebar e viewer aperti.
- Placeholder del composer non più troncato ("Fai una domanda..."); le scorciatoie sono nel testo di aiuto collegato con `aria-describedby` (`ChatComposer.tsx`).

### Docs (T033)
- `docs/ROADMAP.md`: P1-13 `done`; a P2-09 aggiunto il criterio sulla sovrapposizione a 1024 px (finding del tester, preesistente).

### Added (T032, P1-12)
- Skip link "Vai alle citazioni" nel viewer (`PdfFactCheckViewer.tsx`): primo tab stop, Enter porta alla prima card citazione (2 pressioni di tasto, scelta motivata da WCAG 2.4.3 rispetto al riordino del DOM).
- Test: `tests/integration/focus-p1-12.test.tsx`, `e2e/focus.spec.ts` (e2e mirati x3: 15 passed; suite completa 25 passed).

### Fixed (T032, P1-12)
- Dopo "Interrompi" (click o Enter) e a fine stream naturale il focus va sulla textarea invece di perdersi sul body o sul pulsante Invia disabilitato (`ChatComposer.tsx`).
- Focus ring più visibili: "Interrompi" (indigo-600 / indigo-400, 6.29:1 e 5.98:1) e regione PDF, card e skip link (amber-400, 12.08:1 e 8.76:1), misurati dal tester.

### Security (T031, P0-09)
- `package.json`: override `next > postcss ^8.5.28` (righe 55-59); `npm audit --omit=dev` passa da 2 vulnerabilità (1 high) a 0, senza Next 16. Restano 5 high solo-dev nella catena `braces` (nessun fix), accettati nell'ADR `docs/adr/0006-gestione-vulnerabilita-dipendenze.md`. Gate, e2e 21/21 e build exit 0.

### Docs (T030)
- `docs/ROADMAP.md`: nuovi item `todo` dai findings di T001–T029 (P0-09, P1-12…P1-15, P2-08…P2-13), sezione "Findings non trasformati in item (con motivo)", esito delle suite e2e complete in P2-06 (17 passed, T027) e P2-07 (20/20, T028). README §7/§8 riallineati con rimandi per id; nessun finding aperto senza item.

### Added (T029, P2-02)
- Mini-thumbnail nelle card citazione: miniatura 140 px della pagina citata con le sole regioni di quella pagina (`CitationThumbnail.tsx`, `CitationThumbnailPage.tsx`, caricata con `next/dynamic` `ssr: false`). Lazy: nessun download né parsing finché la card non entra nel viewport (`IntersectionObserver`, `rootMargin` 200 px); placeholder a dimensione fissa; in caso di errore di download lo stato resta `error` senza rompere la card.
- Cache Blob per `document_id` (`useDocumentFile.ts`, chiave `queryKeys.documents.file`): un solo download per documento, condiviso tra miniature e viewer (`usePdfDocument.ts` la riusa).
- Test: `tests/integration/CitationThumbnail.test.tsx`, helper `src/test/intersectionObserver.ts`, `e2e/thumbnails.spec.ts`.

### Changed (T029, P2-02)
- `usePdfDocument.ts`: il viewer segue ora la policy di retry dell'app, essendo basato su `useDocumentFile`.

### Added (T028, P2-07)
- Tema scuro che segue `prefers-color-scheme` (`app/globals.css`: `color-scheme: light dark`, sfondo/testo del body in dark) e varianti `dark:` in chat, documenti, citazioni e storico (`ChatComposer.tsx`, `ChatConversation.tsx`, `ChatHeader.tsx`, `ChatMessageItem.tsx`, `ChatWorkspace.tsx`, `WelcomePanel.tsx`, `MarkdownRenderer.tsx`, `DocumentListModal.tsx`, `DocumentUploadDropzone.tsx`, `RelatedDocumentsSection.tsx`, `HistoryEntryNotice.tsx`). Nessun toggle manuale; sidebar, login e viewer PDF invariati, la pagina PDF resta su sfondo bianco.
- Spec `e2e/dark-theme.spec.ts`: sfondo scuro del body e 0 violazioni axe `color-contrast` su login, chat, modale documenti e viewer in dark.

### Fixed (T028, P2-07)
- Contrasto dell'ID documento in tema chiaro (`DocumentListModal.tsx`): `slate-500` su bianco, 4.76:1 (prima `slate-400`, 2.63:1).

### Added (T027, P2-06)
- Nuova devDependency `@axe-core/playwright` (`package.json`) e spec `e2e/a11y.spec.ts`: controllo `lang="it"` e 0 violazioni axe `serious`/`critical` (WCAG 2.1 A/AA) su login, chat con citazioni e viewer PDF aperto.

### Fixed (T027, P2-06)
- `app/layout.tsx:21`: `<html lang="it">` (prima `en`).
- Contrasto colori (`color-contrast`) in `LoginForm.tsx`, `ChatComposer.tsx`, `ChatMessageItem.tsx`, `RelatedDocumentsSection.tsx`, `ChatSidebar.tsx`, `BoundingBoxOverlay.tsx` (badge attivo `amber-800`).
- `PdfFactCheckViewer.tsx`: `aria-label="Numero di pagina"` sull'input pagina; contenitore PDF `role="region"`, `tabIndex={0}`, `aria-label="Pagina PDF"` (area scrollabile raggiungibile da tastiera).

### Changed (T027, P2-06)
- `ChatMessageItem.tsx`: orario dei messaggi in formato `it-IT` (`toLocaleTimeString("it-IT")`).

### Added (T026, P2-05)
- Annullamento dell'upload in corso: `useDocumentUpload.ts` usa un `AbortController` (`cancel()`, abort anche allo smontaggio); `DocumentUploadDropzone.tsx` mostra "Annulla" solo durante l'upload; `uploadDocuments(files, signal?)` in `src/api/documents.ts`. Dopo l'annullamento nessun messaggio di successo o errore, nessun refetch della lista, file ancora selezionati.
- Test: `tests/integration/document-upload-cancel.test.tsx` (33 file / 246 test).

### Changed (T025, P2-04)
- `src/api/pagination.ts`: `fetchAllPages` (limit=100, tutte le pagine) rimosso; ora `fetchPage` (limit 20) e `nextOffset`. `useChatList` e `useDocuments` usano `useInfiniteQuery`.
- Decisione "letterale" documentata in `docs/adr/0005-paginazione-letterale.md`.

### Added (T025, P2-04)
- `ChatSidebar.tsx`: pulsante "Carica altre" (offset=20, ...) e suffisso `+` sul conteggio; `DocumentListModal.tsx`: "Carica altri" e badge `20+`; errore della pagina successiva in `role="alert"`.
- Test: `tests/integration/chat-list-pagination.test.tsx`, `tests/unit/pagination.test.ts`, `tests/unit/api-client.test.ts` (32 file / 244 test).

### Fixed (T024, P2-03)
- `src/components/ui/streamingMarkdown.ts`: `stripIncompleteTrailingTag` rimuove in coda il tag HTML non ancora chiuso, così durante lo stream non compare testo HTML letterale (`<t`, `<ul`); applicato in `MarkdownRenderer.tsx`, sanitizzazione invariata.
- Test: `tests/unit/MarkdownRenderer.streaming.test.tsx` (ogni prefisso carattere per carattere di `MOCK_RESPONSE_TABLE` e `MOCK_RESPONSE_UL`).

### Added (T023, P2-01)
- `src/features/factcheck/hooks/useCitationHighlight.tsx`: context locale (`CitationHighlightProvider` in `ChatWorkspace.tsx`) per l'highlight bidirezionale citazione e PDF.
- Click su un box: la card ha `aria-current="true"` e viene portata in vista con `scrollIntoView` senza spostare il focus.
- Hover o focus su una card: i box della citazione hanno `data-highlighted="true"` (solo pagina visualizzata).
- Test: `tests/integration/citation-highlight.test.tsx`.

### Docs (T022)
- Tabella di stato di `docs/ROADMAP.md` e README riallineati dopo la chiusura degli item P1 (path in `src/`, limiti risolti rimossi, "With More Time" con solo lavoro aperto).

### Added (T021, P1-10)
- `src/features/history/hooks/useSidebarOpen.ts`: stato della sidebar (chiusa di default sotto 768 px).
- Test: `e2e/keyboard.spec.ts` (flusso da sola tastiera) e `tests/integration/a11y-keyboard.test.tsx`.

### Changed (T021, P1-10)
- Card di suggerimento, lista CITAZIONI e bounding box sono `<button>`; le bbox sono fuori dal tab order (`tabIndex={-1}`).
- La dropzone ha `role="button"` e si attiva con Enter/Spazio.
- Durante lo stream la textarea è `readOnly` + `aria-disabled` invece di `disabled` (ADR 0003 invariato), così il focus non si perde.
- L'area messaggi ha `role="log"`, `aria-live="polite"` e `aria-busy`.
- Sidebar chiusa di default sotto 768 px e sempre montata; modale documenti chiusa con Escape e rivalidata all'apertura.

### Fixed (T021, P1-10)
- La sidebar copriva il composer su mobile.
- Flakiness di `e2e/session.spec.ts` (login reso robusto).

### Added (T020, P1-09)
- `src/features/factcheck/components/FactCheckPanel.tsx`: contenitore del viewer; a ≥ 1024 px è un pannello laterale (`role="complementary"`, `aria-label="Verifica fonti"`), sotto è un dialog a schermo intero (`role="dialog"`, `aria-modal`) con trap del Tab.
- `src/features/factcheck/hooks/useIsDesktop.ts` (media query `min-width: 1024px`) e `isSameCitation` in `src/features/factcheck/lib/citations.ts`.
- Test: `tests/unit/citations.test.ts`, `tests/integration/FactCheckPanel.test.tsx`; e2e `e2e/layout.spec.ts`.

### Changed (T020, P1-09)
- Il viewer PDF non è più una modale fissa: è un pannello affiancato alla conversazione (≥ 1024 px) o un drawer a schermo intero (< 1024 px); la lista citazioni sta sotto il PDF.
- Le card citazione in `RelatedDocumentsSection.tsx` sono `<button>` con `aria-current`; la citazione attiva è evidenziata anche sul PDF (`data-active` in `BoundingBoxOverlay.tsx`).
- All'apertura il focus va al pannello; alla chiusura torna alla card della citazione.

### Fixed (T020, P1-09)
- `Escape` non chiudeva il viewer.

### Added (T019, P1-07)
- ADR 0004 (`docs/adr/0004-modello-storico.md`): una chat del backend è una coppia domanda/risposta; multi-turno solo locale.
- `src/features/history/components/HistoryEntryNotice.tsx`: nota mostrata mentre è aperta una voce dello storico.
- `aria-current` e `data-testid="history-entry"` sulle voci della sidebar.
- Test: `tests/integration/history-model.test.tsx`; e2e `e2e/history.spec.ts`.

### Changed (T019, P1-07)
- Invio e Riprova con una voce selezionata avviano una nuova sessione locale: la selezione è annullata, la voce resta invariata e a fine stream compare una nuova voce in cima.
- Il cambio di voce svuota subito la conversazione.
- La data della voce nella sidebar include l'ora.

### Added (T018, P1-05)
- `src/api/session.ts`: handler 401 centralizzato (`setUnauthorizedHandler`, `notifyUnauthorized`, `resetUnauthorizedGuard`); messaggio `session_expired` ("Sessione scaduta, accedi di nuovo") in `src/api/errorMessages.ts`.
- Test: `tests/integration/session-401.test.tsx`, `src/test/memoryStorage.ts`; e2e `e2e/session.spec.ts`.

### Changed (T018, P1-05)
- `useSession` ha lo stato `hydrating` e legge `localStorage` dopo il mount; `app/page.tsx` mostra un placeholder durante l'idratazione.
- Il logout svuota anche la cache di TanStack Query. Il backend non ha un endpoint di logout: il cookie resta.

### Fixed (T018, P1-05)
- Hydration mismatch al reload da loggato.

### Added (T017, P1-04)
- `src/api/errorMessages.ts`: mappa unica `ERROR_MESSAGES` (codice → messaggio in italiano), `messageKeyFor`, `extractRejectedFilename`; `toUserMessage` e `logError` in `src/api/errors.ts`.
- Test: `tests/unit/errorMessages.test.ts`, `tests/integration/error-messages-ui.test.tsx`, aggiornato `tests/unit/api-errors.test.ts`; e2e `e2e/upload-errors.spec.ts` (upload di un PDF non ammesso).

### Changed (T017, P1-04)
- Query vuota e query troppo lunga hanno messaggi distinti; l'errore HTTP generico non mostra più lo status code.
- Gli errori di lista documenti, storico e dettaglio chat sono loggati in console (`cause`).

### Removed (T017, P1-04)
- Costanti sparse dei messaggi e override `errorMessages` (`client.ts`, `errors.ts`, `index.ts`).

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
