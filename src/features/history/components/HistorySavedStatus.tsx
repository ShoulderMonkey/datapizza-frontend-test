'use client';

import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { SAVED_CHAT_ANNOUNCEMENT } from '../hooks/useSavedChat';

interface HistorySavedStatusProps {
  /** False while the question is in flight: the live region is mounted empty, then filled. */
  isSaved: boolean;
}

/**
 * Polite live region announcing that the answer was stored as a new history entry (P1-14, ADR 0007).
 * It is mounted when a question is sent and filled only after a successful stream, so the text is
 * an update of an existing live region (reliably announced) and nothing is said on error or abort.
 */
export function HistorySavedStatus({ isSaved }: HistorySavedStatusProps) {
  return (
    <p
      role="status"
      aria-live="polite"
      data-testid="history-saved-status"
      className={
        isSaved
          ? 'max-w-3xl mx-auto mb-2 px-4 flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-400'
          : 'sr-only'
      }
    >
      {isSaved && (
        <>
          <CheckCircle2 aria-hidden="true" className="w-3.5 h-3.5 shrink-0" />
          <span>{SAVED_CHAT_ANNOUNCEMENT}</span>
        </>
      )}
    </p>
  );
}
