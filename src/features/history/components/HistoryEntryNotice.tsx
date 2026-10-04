'use client';

import React from 'react';
import { History } from 'lucide-react';

/**
 * Shown above the composer while a history entry is selected (ADR 0004): a stored chat is one
 * immutable question/answer pair, so a new question never changes it and creates a new entry.
 */
export function HistoryEntryNotice() {
  return (
    <p
      role="note"
      data-testid="history-entry-notice"
      className="max-w-3xl mx-auto mb-2 px-4 flex items-start gap-1.5 text-[11px] text-slate-500"
    >
      <History aria-hidden="true" className="w-3.5 h-3.5 shrink-0 mt-px text-slate-400" />
      <span>
        Stai consultando una voce salvata della cronologia. Una nuova domanda crea una nuova voce: questa
        resta invariata.
      </span>
    </p>
  );
}
