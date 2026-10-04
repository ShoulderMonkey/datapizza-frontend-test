'use client';

import React, { type ReactNode, type RefObject, type UIEvent } from 'react';
import { Spinner } from '@/src/components/ui/Spinner';
import type { ChatMessage, CitationReference } from '../types';
import { ChatMessageItem } from './ChatMessageItem';

interface ChatConversationProps {
  messages: ChatMessage[];
  isLoading: boolean;
  loadError: string | null;
  onRetryLoad: () => void;
  onInspectCitation: (citation: CitationReference) => void;
  /** Undefined while a stream is active (ADR 0003): the rows hide their retry buttons. */
  onRetry?: (message: ChatMessage) => void;
  endRef: RefObject<HTMLDivElement | null>;
  onScroll: (e: UIEvent<HTMLElement>) => void;
  /** Rendered when there are no messages. */
  emptyState: ReactNode;
}

/** Scrollable message area: loading, load error, empty state or the message list. */
export function ChatConversation({
  messages,
  isLoading,
  loadError,
  onRetryLoad,
  onInspectCitation,
  onRetry,
  endRef,
  onScroll,
  emptyState,
}: ChatConversationProps) {
  return (
    <div className="flex-1 overflow-y-auto" onScroll={onScroll}>
      {isLoading ? (
        <div className="py-20 text-center space-y-3">
          <Spinner className="w-8 h-8 mx-auto" />
          <p className="text-sm font-medium text-slate-600">Caricamento conversazione in corso...</p>
        </div>
      ) : loadError ? (
        <div className="max-w-md mx-auto my-12 p-6 bg-red-50 border border-red-200 rounded-2xl text-center space-y-3">
          <p className="text-sm font-semibold text-red-800">Errore di caricamento</p>
          <p className="text-xs text-red-600">{loadError}</p>
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
          {messages.map((message) => (
            <ChatMessageItem
              key={message.id}
              message={message}
              onInspectCitation={onInspectCitation}
              onRetry={onRetry}
            />
          ))}
          <div ref={endRef} />
        </div>
      )}
    </div>
  );
}
