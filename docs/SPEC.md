# Test tecnico - Frontend Software Engineer

La figura cercata ha competenze solide di Frontend (React, UI/UX), è in grado di integrare API REST/streaming e di lavorare con design già forniti da altri ruoli (designer, product).

Il test prevede:
1. Una componente Backend già pronta, fornita da Datapizza (FastAPI + Docker).
2. Una componente Frontend, da sviluppare.

Il test replica una situazione reale, per capire come il candidato prende decisioni, struttura il codice e gestisce i dettagli di UX, error handling e integrazione API.

## Obiettivo del test
Sviluppare una web app di chat che consenta a un utente di:
- porre domande a un chatbot (simulato a backend);
- caricare documenti PDF forniti;
- visualizzare, insieme alle risposte, i documenti correlati e le relative aree evidenziate (bounding box) per fare fact-checking.

Si valuta:
- come viene progettata l'interfaccia utente di una chat;
- come vengono gestiti stato, streaming e concorrenza lato client;
- come vengono presentate le informazioni di fact-checking (documenti correlati, pagine, highlight);
- come vengono gestiti errori e stati di loading in modo chiaro per l'utente.

## Panoramica del Backend fornito
Il backend è già implementato e containerizzato. Codice nel repository GitHub: https://github.com/datapizzaorg-ai-lab/test-tecnico-frontend-engineer (dettagli tecnici nel README.md).

### Tecnologie backend
Python 3.12, FastAPI, Uvicorn, Docker + Docker Compose.

### Funzionalità disponibili
1. Autenticazione mock via cookie
   - Endpoint: `POST /api/auth/login`
   - Corpo richiesta: `{"user_id": "<stringa>"}` (solo alfanumerico, `-` e `_`).
   - Risultato: imposta un cookie `user_id` che autentica le richieste successive.
2. Gestione documenti (PDF)
   - `POST /api/documents/`: upload di uno o più PDF (multipart form, campo `files`). Il backend controlla che i PDF corrispondano a quelli forniti da Datapizza. Se tutto è ok, salva i documenti in una "base dati" in memoria e restituisce metadata (id, filename, ecc.).
   - `GET /api/documents/`: restituisce l'elenco dei documenti caricati.
   - `GET /api/documents/{doc_id}`: restituisce il dettaglio di un singolo documento.
   - `GET /api/documents/{doc_id}/file`: restituisce il file PDF effettivo del documento.
3. Chat con streaming e fact-checking
   - `POST /api/chat/`
     - Input (semplificato): `{"query": "<testo della domanda>"}` più uno storico opzionale.
     - Output: streaming NDJSON (`application/x-ndjson`), righe di JSON una per volta:
       - chunk `{"type": "content", "delta": "<stringa>"}`: testo generato, carattere per carattere;
       - un chunk finale `{"type": "citations", "references": [...]}`: elenco di riferimenti ai documenti.
     - Ogni reference include: `document_id`, `filename`, `page_number`, `text_quote` (frase giustificativa), `bounding_regions` (lista di oggetti `{"page_number": int, "rects_in": [[x, y, width, height], ...]}` in coordinate inches).
     - Le risposte del chatbot contengono volontariamente Markdown e HTML (tabelle, liste, testo formattato).
   - `GET /api/chat/`: restituisce lo storico delle chat per l'utente corrente.
   - `GET /api/chat/{chat_id}`: restituisce il dettaglio di una singola chat.

Schema completo su Swagger UI: http://localhost:8000/docs

## Cosa sviluppare (Frontend)

### Tecnologie richieste
- React (libera scelta di framework/build tool: Vite, CRA, Next.js in modalità SPA, ecc.)
- TypeScript
- Librerie UI (Material UI, Chakra, Tailwind, ecc.) oppure CSS custom.

### Funzionalità minime richieste
1. Autenticazione mock
   - Schermata/flow per "loggarsi" inserendo un `user_id` (o usandone uno di default).
   - Chiamata a `POST /api/auth/login` e gestione del cookie lato browser (gestito automaticamente dal browser una volta effettuata la chiamata).
   - Gestione degli errori di validazione (user_id vuoto, troppo lungo, caratteri non permessi).
2. Upload e gestione documenti PDF
   - UI per caricare uno o più PDF (usare quelli nella cartella `data/pdfs`; se ne vengono caricati altri, il backend ritorna un errore che va gestito).
   - Chiamata a `POST /api/documents/`.
   - Visualizzazione dello stato di caricamento e degli eventuali errori (file non valido, nessun file selezionato, ecc.).
   - Visualizzazione della lista di documenti caricati (`GET /api/documents/`).
3. Interfaccia chat con streaming
   - Layout principale con: area di chat (lista messaggi), input per la domanda utente, pulsante "Invia".
   - Integrazione con `POST /api/chat/` in modalità streaming NDJSON: lettura dello stream dal backend e aggiornamento progressivo del messaggio del chatbot man mano che arrivano i chunk `type: "content"`.
   - Gestione stati: loading (richiesta in corso), errori (query vuota, problemi di rete, errori streaming), fine dello stream.
   - Rendering delle risposte del chatbot con supporto a Markdown (titoli, liste, tabelle) e HTML inline (ad es. `<table>`, `<strong>`, `<ul>`). Qualsiasi libreria, gestendo la sicurezza XSS.
4. Fact-checking: documenti correlati e bounding regions
   - Per ogni risposta del chatbot, un meccanismo di fact-checking: un bottone o una sezione "Documenti correlati" che elenca le citations ricevute dallo stream (`type: "citations"`) e per ciascuna mostra almeno filename, pagina, text_quote.
   - Visualizzazione: mostrare visivamente le bounding regions sul PDF (o su un'immagine/snapshot, o con una rappresentazione schematica). Si può usare `GET /api/documents/{doc_id}/file` per recuperare il PDF. Scelta libera (overlay su preview PDF, mini-thumbnail, rappresentazione testuale con coordinate, ecc.): conta come si ragiona sul problema.
5. Lista delle chat
   - UI per vedere l'elenco delle chat precedenti (`GET /api/chat/`) e selezionare una chat per vederne il contenuto (`GET /api/chat/{chat_id}`).
   - L'integrazione con lo storico deve essere coerente con la UI principale di chat (es. lista a sinistra, pagina dedicata, ecc.).

## Cosa verrà valutato
- Qualità del codice
  - Struttura del progetto React (componenti, hooks, stato globale vs locale).
  - Pulizia, leggibilità, uso di TypeScript.
  - Separazione tra logica di chiamata API e componenti UI.
- Gestione dello streaming
  - Corretto consumo di uno stream NDJSON.
  - Aggiornamento incrementale della UI.
  - Gestione di errori durante lo streaming (chunk di tipo `error`, errori di rete, interrompere lo stream in modo pulito, ecc.).
- UX e micro-interazioni
  - Stati di loading chiari (login, upload documenti, invio messaggio, caricamento storico).
  - Errori comprensibili per l'utente finale (non solo messaggi tecnici).
  - Layout efficace per mostrare conversazione, documenti correlati, fact-checking/bounding box.
- Utilizzo del backend
  - Corretta comprensione degli endpoint (autenticazione via cookie, upload PDF, chat streaming).
  - Uso coerente di HTTP methods, headers, body.
  - Capacità di leggere e capire la documentazione in Swagger.

## Setup e avvio backend
1. Clonare il repo.
2. Da `test-tecnico-frontend-engineer/`, avviare `docker-compose up --build`.
3. Verificare che http://localhost:8000/docs sia raggiungibile e che `/api/auth/login` risponda correttamente a una richiesta di test.

Il frontend può stare in una sottocartella del repo del backend o in un repo separato, purché sia documentato nel README.

## Deliverable attesi
Un repository GitHub contenente:
- Codice sorgente del frontend, con struttura del progetto chiara, dipendenze e script di avvio documentati (README), eventuali istruzioni particolari per lo streaming o per il rendering dei PDF.
- Dockerfile e (opzionale) docker-compose per il frontend, in modo che sia facilmente avviabile (anche solo esponendo la porta di dev).
- Un README che spieghi come avviare il frontend ed eventuali note su decisioni architetturali, trade-off, limiti, cose che si sarebbero fatte con più tempo.

A lavori terminati: rendere accessibile il repository agli utenti GitHub sisco404, ChenEmmaL, mastercrys; segnalare la conclusione via mail a ai@datapizza.tech, in cc francescoforesi@datapizza.tech, chen@datapizza.tech, cristianoortolani@datapizza.tech.

## Note finali
Alcune specifiche sono volutamente vaghe. Prendere iniziativa va bene, purché si rispettino le funzionalità minime richieste e si documentino chiaramente le scelte nel README. Non esiste una sola soluzione corretta: interessa capire come si ragiona e come si scrive codice in un contesto vicino a quello reale in Datapizza.
