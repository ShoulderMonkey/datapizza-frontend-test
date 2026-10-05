# 0006 — Gestione delle vulnerabilità delle dipendenze

**Stato:** accettato

**Data:** 2026-10-05 — Item: P0-09 (T031)

**Contesto**

Prima dell'intervento `npm audit --omit=dev` riportava 2 vulnerabilità: il `postcss` annidato 8.4.31 dentro `next@15.5.27` (advisory GHSA-qx2v-qp2m-jg93, GHSA-6g55-p6wh-862q, GHSA-fxqj-rqcc-2cmp, GHSA-r28c-9q8g-f849, range `<=8.5.22`). Il fix proposto da npm era solo `next@16.3.8`, un major con breaking change. `npm audit` completo riportava 7 vulnerabilità (1 moderate, 6 high).

**Decisione**

Override `next > postcss` a `^8.5.28` in `package.json` (sezione `overrides`, righe 55-59). `postcss` 8.5.28 era già presente al livello superiore; `npm ls postcss` mostra `next@15.5.27 -> postcss@8.5.28` deduplicato e nessun 8.4.31. Non si passa a Next 16 (`next@15.5.27` è l'ultima 15.x). Non si fa downgrade di `eslint-config-next` a 14.x né si usa `npm audit fix --force`. Esito: `npm audit --omit=dev` = 0 vulnerabilità; build ed e2e verdi.

**Rischio residuo solo-dev**

Restano 5 high solo-dev nella catena `eslint-config-next > @next/eslint-plugin-next > fast-glob@3.3.1 > micromatch@4.0.8 > braces@3.0.3` (GHSA-vfj7-8cjw-p6xm, DoS). `braces@3.0.3` è l'ultima versione pubblicata e non esiste un fix. La catena è usata solo da ESLint su pattern glob del repository, senza input utente, e non entra nel bundle di produzione. Un override di `fast-glob` non elimina la catena, perché ogni `fast-glob` dipende da `micromatch`. Un `postcss` vulnerabile sarebbe sfruttabile solo con CSS non controllato dall'utente, assente in questa applicazione.

**Alternative considerate**

- Passare a Next 16: major breaking, fuori scopo per una vulnerabilità risolvibile con un override.
- Downgrade di `eslint-config-next` a 14.2.35 (fix proposto da npm): incoerente con Next 15.
- `npm audit fix --force`: applicherebbe i due major precedenti senza controllo.
- Accettare il rischio su `postcss` senza intervenire: scartato, l'override lo elimina a costo minimo.

**Conseguenze**

- `npm audit --omit=dev` pulito; `npm audit` completo mostra 5 high solo-dev, accettati.
- Rimuovere l'override quando `next` aggiornerà il proprio `postcss` (>= 8.5.23).
- Rieseguire `npm audit` periodicamente e, dopo un'installazione pulita, verificare con `npm ls postcss`.
