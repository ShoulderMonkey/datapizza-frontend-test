// Copied from backend/src/routes/chat.py MOCK_RESPONSES (lines ~44-47 and following).
export const MOCK_RESPONSE_TABLE = `
## Analisi del documento

Di seguito una sintesi in formato **Markdown**:

- **Oggetto**: Contratto di fornitura
- **Parti coinvolte**: Cliente, Fornitore

| Voce   | Valore      |
|--------|-------------|
| Importo| 10.000 €    |
| Scadenza | 31/12/2025 |

Esempio di snippet HTML:

<table>
  <tr><th>Campo</th><th>Valore</th></tr>
  <tr><td>Stato</td><td><strong>Approvato</strong></td></tr>
</table>
`;

export const MOCK_RESPONSE_UL = `
### Riepilogo del report trimestrale

Snippet HTML per una lista non ordinata:
<ul>
  <li><strong>Area</strong>: Vendite</li>
  <li><strong>Periodo</strong>: Q1 2025</li>
</ul>
`;
