# 0004 — Modello dello storico: una chat = una coppia domanda/risposta

**Stato:** accettato, punto 5 modificato da ADR 0007

**Data:** 2026-10-04 — Item: P1-07 (T019)

**Contesto**

Il backend salva ogni richiesta a `POST /api/chat/` come un record `{id, user_id, created_at, query, response, citations?}`, scritto a fine stream (`BE:src/dependencies.py:39-57`, `BE:src/routes/chat.py:204-206`, backend esterno in `../test-tecnico-frontend-engineer/`). Una chat del backend è quindi una sola coppia domanda/risposta, immutabile. Lo stream non restituisce l'`id` del record creato. Il campo `history` del body è accettato ma ignorato dal generatore della risposta (`BE:src/routes/chat.py:16-20,119-128`; `docs/AUDIT.md` §2). La UI mostra però una conversazione multi-turno, e prima di questa decisione una nuova domanda con una voce selezionata veniva aggiunta in coda mentre la sidebar continuava a evidenziare la voce: sembrava che la voce fosse stata modificata.

**Decisione**

1. Ogni record del backend è una voce di storico: titolo = `query`, data = `created_at` (giorno e ora, elemento `<time dateTime>`), ordinate per `created_at` decrescente (`src/features/history/components/ChatSidebar.tsx`, `src/features/history/hooks/useChatList.ts`). La voce selezionata ha `aria-current`.
2. Selezionare una voce mostra domanda, risposta renderizzata e le citazioni salvate (`Documenti correlati`), da cui si apre il PDF. La conversazione precedente viene svuotata subito, così non resta visibile durante il caricamento e non finisce nella `history`.
3. Una nuova domanda (o un Riprova) con una voce selezionata avvia una nuova sessione locale: la selezione viene annullata (nessuna voce con `aria-current`, titolo 'Nuova sessione'). La domanda e la risposta della voce restano visibili come contesto e vengono inviate in `history` senza promettere effetti. Il backend crea una nuova chat; la voce selezionata non viene modificata. Mentre una voce è aperta, una nota sopra il composer lo spiega (`HistoryEntryNotice`).
4. La conversazione multi-turno esiste solo nel client. Il campo `history` viene inviato per compatibilità con lo schema (`docs/api/openapi.json`), ma la UI non dichiara che il modello lo usi.
5. A fine stream la lista viene ricaricata (`onStreamEnd` → `history.refresh`) e la nuova voce compare in cima, **non selezionata**. *(Modificato da ADR 0007: la nuova voce viene marcata con `aria-current` senza selezionarla.)*

**Alternative considerate**

- Conversazione sempre pulita all'invio: più semplice, ma fa sparire la voce che l'utente stava leggendo proprio mentre fa una domanda di approfondimento.
- Accodare alla voce selezionata (comportamento precedente): incoerente con il backend, perché la voce non cambia mai lato server, e ingannevole nella UI.
- Selezionare automaticamente la nuova voce a fine stream, individuandola come la più recente con `query` uguale: l'id non arriva nello stream, quindi l'abbinamento è euristico (domande ripetute, voci create da un'altra scheda). Inoltre selezionarla sostituirebbe la conversazione locale multi-turno con una sola coppia Q/A. Scartata per semplicità e robustezza.

**Conseguenze**

- La sidebar e il backend coincidono: N domande inviate = N nuove voci, la più recente in alto.
- Il contesto multi-turno si perde al ricaricamento della pagina o selezionando una voce (lo storico server ha solo coppie Q/A); è un limite del backend, non della UI.
- Comportamento verificabile: dopo un invio riuscito la nuova voce ha `aria-current` (ADR 0007), la voce selezionata in precedenza mantiene titolo e contenuto, e la lista ricaricata contiene una voce in più in cima.

Riferimenti codice: src/features/chat/components/ChatWorkspace.tsx:25-112 (docblock, handleSelectChat, handleSend, handleRetry), src/features/history/components/ChatSidebar.tsx:38,201-218 (titolo :215), src/features/history/components/HistoryEntryNotice.tsx, src/features/chat/hooks/useChatStream.ts:143-145 (history inviata).
- Test: `tests/integration/history-model.test.tsx` (selezione annullata all'invio, `history` con la Q/A di A, nuova voce in cima con A invariata) ed `e2e/history.spec.ts` (2 domande, 2 voci, la più recente in alto; selezione voce con Q/A, Documenti correlati e PDF; nuova domanda con voce selezionata, +1 voce e A invariata).
