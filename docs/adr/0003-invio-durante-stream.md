# 0003 — Invio di un nuovo messaggio durante uno stream attivo

**Stato:** accettato

**Data:** 2026-10-04 — Item: P1-03 (T016)

**Contesto**

`POST /api/chat/` risponde con uno stream NDJSON (un delta di circa 1 carattere ogni ~20 ms, `docs/AUDIT.md` §2). Il backend salva ogni chat come una sola coppia domanda/risposta, alla fine dello stream. Se l'utente invia una nuova domanda mentre una risposta è in streaming, il client deve scegliere:
- (A) disabilitare l'invio finché lo stream non finisce o non viene interrotto;
- (B) interrompere lo stream precedente e partire con il nuovo.

**Decisione**

Scelta (A): invio disabilitato. Durante lo stream il composer è disabilitato e mostra il pulsante "Interrompi" al posto di "Invia"; i pulsanti "Riprova" dei messaggi precedenti sono nascosti. Per fare una nuova domanda l'utente preme "Interrompi" (il messaggio parziale resta con stato `aborted`) e poi invia.

La regola vale a tre livelli:
- **reducer**: `chatStreamReducer` ignora `start` se `isStreaming` (`src/features/chat/lib/chatStreamReducer.ts:69`);
- **hook**: `useChatStream.send` non fa nulla se c'è una richiesta in corso (`src/features/chat/hooks/useChatStream.ts:118`);
- **UI**: `ChatComposer.handleSubmit` esce se `isStreaming` (`src/features/chat/components/ChatComposer.tsx:42`); `ChatWorkspace` passa `onRetry` solo quando non c'è stream (`src/features/chat/components/ChatWorkspace.tsx:112`).

Motivazioni:
1. **Nessuna race**: con (B) la history della nuova richiesta conterrebbe o escluderebbe una risposta parziale a seconda del momento dell'abort, e il backend potrebbe aver già salvato o no la chat interrotta; con (A) la history si costruisce solo da messaggi `completed`.
2. **Un solo `AbortController` e un solo messaggio attivo**: il reducer mantiene l'invariante `activeAssistantId != null` se e solo se `isStreaming`, semplice da testare.
3. **UX esplicita**: interrompere è un'azione visibile e volontaria, non un effetto collaterale dell'invio; il testo parziale non si perde per un Invio premuto per sbaglio.
4. **Costo basso**: le risposte durano pochi secondi e lo Stop è sempre disponibile.

**Alternative considerate**

- (B) interrompere e ripartire: un clic in meno, ma introduce la race sulla history, due richieste concorrenti per un breve intervallo e la perdita implicita della risposta in corso.
- Coda delle domande: complessità non richiesta dalla specifica.

**Conseguenze**

- Il cambio chat e "nuova chat" abortiscono comunque lo stream (`cancel` e `replaceMessages`), perché lo stream appartiene alla conversazione precedente; l'abort lascia il testo parziale con stato `aborted` e "Riprova".
- Ogni livello della regola è verificato da un test: `start` ignorato nel reducer (`tests/unit/chatStreamReducer.test.ts:28`); composer disabilitato, "Interrompi" presente, "Riprova" assente e una sola POST con Enter in integrazione (`tests/integration/ChatWorkspace.abort.test.tsx:127`).
