# 0008 — Viewer PDF a scroll continuo con rendering lazy e text layer

**Stato:** accettato

**Data:** 2026-10-05 — Item: P2-13 (T043)

**Contesto**

Il viewer mostrava una sola pagina con `renderTextLayer={false}`: il testo non era selezionabile e la navigazione procedeva una pagina alla volta (limite del README §7, item P2-13).

**Decisione**

1. Tutte le pagine sono in colonna, con segnaposto a misura esatta: le dimensioni sono lette dal worker pdf.js senza disegnare (`src/features/factcheck/hooks/usePdfPageSizes.ts`).
2. Sono disegnate solo le pagine entro un'altezza del contenitore sopra e sotto la zona visibile (`IntersectionObserver` con `RENDER_ROOT_MARGIN = '100% 0px'`, `PdfPageView.tsx:19`, osservatore a `:207-223`); fuori da quella fascia le pagine vengono liberate.
3. La pagina corrente è quella sotto il centro del contenitore (`findPageAtLine`, ricerca binaria in `src/features/factcheck/lib/pageLayout.ts`, usata in `PdfPageView.tsx:144`).
4. La navigazione è una richiesta esplicita, separata da `currentPage` (`PdfFactCheckViewer.tsx:87-95`): i salti lontani sono istantanei, la regione viene riallineata al primo render della pagina di destinazione (`PdfPageView.tsx:240-251`) e lo zoom mantiene il punto al centro (`:259`).
5. Il proxy pdf.js è condiviso con le thumbnail (`useDocumentProxy`, `PdfPageView.tsx:60`): nessun secondo parse.
6. Il text layer usa `react-pdf/dist/Page/TextLayer.css` (`PdfPageSlot.tsx:7`, `renderTextLayer` a `:70`). L'overlay dei box sta sopra di esso con `pointer-events: none`, riattivati solo sui box (`BoundingBoxOverlay.tsx:69,96`), così il testo fuori dai box resta selezionabile.
7. L'annotation layer è spento (`PdfPageSlot.tsx:71`): link e form aggiungerebbero tab stop senza servire il fact-checking.

**Alternative considerate**

- Pagina singola con text layer: non risolve la navigazione.
- Virtualizzazione con una libreria esterna (ad esempio `react-window`): scartata, nessuna dipendenza nuova; il lazy rendering con pagine a misura fissa basta.
- Pagina corrente come "pagina più visibile": scartata, con una regione centrata vicino al bordo può indicare la pagina sbagliata.

**Conseguenze**

- La memoria resta limitata a poche pagine disegnate (1 su 15 all'apertura a 1280 px, dal report del tester).
- All'apertura c'è una lettura delle dimensioni per ogni pagina (solo metadati).
- I box di tutte le pagine sono nel DOM: gli e2e verificano il bbox attivo, non il primo nel DOM.
- Il testo del PDF è leggibile dagli screen reader.
- Verifica: `tests/unit/pageLayout.test.ts`, `e2e/pdf-continuous.spec.ts`.
