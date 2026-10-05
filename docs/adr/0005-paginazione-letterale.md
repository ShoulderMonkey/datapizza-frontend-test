# 0005 — Paginazione letterale di storico e documenti

**Stato:** accettato

**Data:** 2026-10-05 — Item: P2-04 (T025)

**Contesto**

Il backend pagina `GET /api/chat/` e la lista documenti con `limit`/`offset`, in ordine di inserimento ascendente e senza restituire il totale (`BE:backend/src/routes/chat.py:268-272`, `BE:documents.py:121`, backend esterno in `../test-tecnico-frontend-engineer/`). Fino a T024 il client scaricava tutte le pagine con `limit=100` (`fetchAllPages`), che non scala con storici lunghi e non mostra l'uso di `limit`/`offset` richiesto dalla specifica.

**Decisione**

Paginazione letterale, scelta dall'utente: pagine da 20 (`PAGE_SIZE` in `src/api/pagination.ts`), `useInfiniteQuery` in `useChatList` e `useDocuments`, `nextOffset` termina quando una pagina ha meno di 20 voci. La sidebar mostra "Carica altre" (`ChatSidebar.tsx`), la modale documenti "Carica altri", con suffisso `+` sul conteggio e badge `20+`. L'ordine di visualizzazione delle chat resta `created_at` decrescente sulle voci caricate. L'errore della pagina successiva è in `role="alert"` e non perde le voci già caricate.

**Alternative considerate**

- Ibrido (consigliato): paginazione con prefetch per garantire le chat più recenti in cima; più complesso, scartato dall'utente.
- Letterale: scelta adottata.
- Solo UI: scaricare tutto e paginare nell'interfaccia; non riduce le richieste.
- Saltare P2-04: lascerebbe il download completo.

**Conseguenze**

- Con più di 20 chat le più recenti possono comparire solo dopo "Carica altre", perché il backend è ascendente.
- Con un totale multiplo esatto di 20 il suffisso `+` e il pulsante compaiono una volta e la pagina successiva è vuota (nessun totale dal backend).
- Una chat nuova compare in cima solo se rientra nelle pagine caricate.
- Test: `tests/integration/chat-list-pagination.test.tsx`, `tests/unit/pagination.test.ts`.
