# 0007 — Feedback della voce salvata e contesto etichettato

**Stato:** accettato (modifica il punto 5 di ADR 0004)

**Data:** 2026-10-05 — Item: P1-14 (T034)

**Contesto**

ADR 0004 (punto 5) stabiliva che a fine stream la nuova voce compare in cima allo storico **non selezionata**, e scartava la selezione automatica perché (a) lo stream non restituisce l'`id` della chat, quindi l'abbinamento sarebbe euristico (domande ripetute, voci create da un'altra scheda) e (b) selezionarla sostituirebbe la conversazione locale multi-turno con una sola coppia Q/A. P1-14 (finding T019) chiede però un segnale che la voce è stata salvata (voce marcata con `aria-current` e annuncio `role="status"`) e un'etichetta per il contesto della voce precedente.

**Decisione**

1. All'invio (o Riprova) si prende uno snapshot degli `id` delle voci caricate (`begin()` in `src/features/history/hooks/useSavedChat.ts:58`). A fine stream senza chunk `error` la lista viene ricaricata e attesa (`complete()` in `useSavedChat.ts:68-76`; `refresh()` restituisce la lista ricaricata, `src/features/history/hooks/useChatList.ts:39`). La nuova voce è quella presente nella lista ricaricata, assente dallo snapshot e con `query` uguale alla domanda inviata; se più d'una, la più recente per `created_at` (`src/features/history/lib/findSavedChatId.ts`). Sostituisce l'euristica sulla sola `query`. `onStreamEnd` riceve `{ saved, query }` (`src/features/chat/hooks/useChatStream.ts:207`) e non viene chiamato su abort.
2. Lo stato "salvata" è **distinto dalla selezione**: la sidebar marca `activeChatId ?? savedChatId` (`src/features/chat/components/ChatWorkspace.tsx:164`, passato a `ChatSidebar` a :171; `aria-current` in `ChatSidebar.tsx:223`) senza caricare il transcript, quindi la conversazione locale multi-turno resta. Cliccare la voce salvata la seleziona normalmente. Lo stato viene azzerato da nuovo invio, "Nuova conversazione", selezione di una voce, Interrompi e logout (`ChatWorkspace.tsx`: `handleCancelStream`, `handleLogout`, `startNewQuestion`).
3. Una live region `role="status"` `aria-live="polite"` (`src/features/history/components/HistorySavedStatus.tsx:20-21`) è montata vuota all'invio e riempita con "Conversazione salvata nello storico" (`SAVED_CHAT_ANNOUNCEMENT`, `useSavedChat.ts:8`) solo su successo; nulla su chunk `error` o abort.
4. Dopo una nuova domanda con una voce selezionata, i suoi messaggi restano come contesto in un `role="group"` etichettato (`aria-labelledby`) dal testo visibile "Dalla conversazione precedente" (`src/features/chat/components/ChatConversation.tsx:108-124`). Il wrapper esiste già mentre la voce è visualizzata, quindi le righe non vengono rimontate e il log live non le rilegge. La `history` inviata resta invariata.

**Alternative considerate**

- Selezione automatica della nuova voce: scartata, sostituisce la conversazione locale (vedi ADR 0004).
- Abbinamento sulla sola `query`: scartato, ambiguo con domande ripetute.
- Solo annuncio senza marcatura: scartato, P1-14 richiede `aria-current`.
- Regione di status sempre montata: scartata, un `role="status"` vuoto sarebbe sempre presente e lo status di caricamento dello storico non sarebbe più l'unico.

**Conseguenze**

- Con più di 20 chat (paginazione letterale, ADR 0005) il backend elenca in ordine di inserimento, quindi la nuova voce può essere oltre le pagine caricate: l'annuncio resta ma nessuna voce viene marcata.
- Se la lista non era ancora caricata all'invio, una voce più vecchia con la stessa `query` potrebbe essere scambiata per la nuova (mitigato dalla scelta per `created_at`).
- L'header mantiene il titolo 'Nuova sessione' (la voce marcata non è selezionata).
- Comportamento verificabile: dopo un invio riuscito la nuova voce, in cima, ha `aria-current` ed esiste l'annuncio; dopo chunk `error` o Interrompi non c'è né marcatura né annuncio.
- Test: `tests/unit/findSavedChatId.test.ts`, `tests/integration/history-saved-p1-14.test.tsx`, `tests/integration/history-model.test.tsx:50-54`, `e2e/history.spec.ts:76-81`.
