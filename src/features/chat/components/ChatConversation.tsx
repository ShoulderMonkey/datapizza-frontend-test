'use client';

import React, { useId, type ReactNode, type RefObject, type UIEvent } from 'react';
import { History } from 'lucide-react';
import { Spinner } from '@/src/components/ui/Spinner';
import type { ChatMessage, CitationReference } from '../types';
import { ChatMessageItem } from './ChatMessageItem';

interface ChatConversationProps {
  messages: ChatMessage[];
  /** True while a response streams: the live region is busy and is announced at the end. */
  isStreaming?: boolean;
  isLoading: boolean;
  loadError: string | null;
  onRetryLoad: () => void;
  onInspectCitation: (citation: CitationReference) => void;
  activeCitation?: CitationReference | null;
  /** Undefined while a stream is active (ADR 0003): the rows hide their retry buttons. */
  onRetry?: (message: ChatMessage) => void;
  endRef: RefObject<HTMLDivElement | null>;
  onScroll: (e: UIEvent<HTMLElement>) => void;
  /** Rendered when there are no messages. */
  emptyState: ReactNode;
  /**
   * Ids of the leading messages that come from a stored history entry (ADR 0004). They are rendered
   * in their own wrapper, which stays in place when a new question starts: the rows are not remounted
   * and the live region does not read the stored Q/A again.
   */
  entryMessageIds?: ReadonlySet<string>;
  /**
   * True once a new question started after those messages (they are kept as context): the wrapper
   * becomes a group labelled "Dalla conversazione precedente" (P1-14, ADR 0007).
   */
  isEntryContext?: boolean;
}

/** Visible and accessible label of the messages kept from the previous (stored) conversation. */
export const PREVIOUS_CONVERSATION_LABEL = 'Dalla conversazione precedente';

const NO_IDS: ReadonlySet<string> = new Set();

/** Number of leading messages whose id is in `ids` (stored messages always come first). */
function countLeading(messages: readonly ChatMessage[], ids: ReadonlySet<string>): number {
  let count = 0;
  while (count < messages.length && ids.has(messages[count].id)) count += 1;
  return count;
}

/** Scrollable message area: loading, load error, empty state or the message list. */
export function ChatConversation({
  messages,
  isStreaming = false,
  isLoading,
  loadError,
  onRetryLoad,
  onInspectCitation,
  activeCitation,
  onRetry,
  endRef,
  onScroll,
  emptyState,
  entryMessageIds = NO_IDS,
  isEntryContext = false,
}: ChatConversationProps) {
  const contextLabelId = useId();
  const entryCount = countLeading(messages, entryMessageIds);
  const renderMessage = (message: ChatMessage) => (
    <ChatMessageItem
      key={message.id}
      message={message}
      onInspectCitation={onInspectCitation}
      activeCitation={activeCitation}
      onRetry={onRetry}
    />
  );

  return (
    <div
      className="flex-1 overflow-y-auto"
      onScroll={onScroll}
      role="log"
      aria-label="Conversazione"
      aria-live="polite"
      aria-relevant="additions text"
      aria-busy={isStreaming}
    >
      {isLoading ? (
        <div className="py-20 text-center space-y-3">
          <Spinner className="w-8 h-8 mx-auto" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Caricamento conversazione in corso...</p>
        </div>
      ) : loadError ? (
        <div className="max-w-md mx-auto my-12 p-6 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-2xl text-center space-y-3">
          <p className="text-sm font-semibold text-red-800 dark:text-red-300">Errore di caricamento</p>
          <p className="text-xs text-red-600 dark:text-red-400">{loadError}</p>
          <button
            onClick={onRetryLoad}
            className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium cursor-pointer"
          >
            Riprova a caricare
          </button>
        </div>
      ) : messages.length === 0 ? (
        emptyState
      ) : (
        <div className="pb-4">
          {entryCount > 0 && (
            <div
              key="history-entry-messages"
              role={isEntryContext ? 'group' : undefined}
              aria-labelledby={isEntryContext ? contextLabelId : undefined}
              data-testid="history-entry-messages"
              data-context={isEntryContext ? 'true' : undefined}
              className={isEntryContext ? 'border-b border-dashed border-slate-300 dark:border-slate-700' : undefined}
            >
              {isEntryContext && (
                <p
                  id={contextLabelId}
                  className="max-w-3xl mx-auto px-4 pt-4 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400"
                >
                  <History aria-hidden="true" className="w-3.5 h-3.5 shrink-0" />
                  <span>{PREVIOUS_CONVERSATION_LABEL}</span>
                </p>
              )}
              {messages.slice(0, entryCount).map(renderMessage)}
            </div>
          )}
          {messages.slice(entryCount).map(renderMessage)}
          <div ref={endRef} />
        </div>
      )}
    </div>
  );
}
