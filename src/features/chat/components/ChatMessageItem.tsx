'use client';

import React from 'react';
import { MarkdownRenderer } from '@/src/components/ui/MarkdownRenderer';
import { RelatedDocumentsSection } from '@/src/features/factcheck/components/RelatedDocumentsSection';
import type { ChatMessage, CitationReference } from '../types';
import { Bot, User, AlertCircle, RotateCcw, StopCircle } from 'lucide-react';

interface ChatMessageItemProps {
  message: ChatMessage;
  onInspectCitation: (citation: CitationReference) => void;
  onRetry?: (message: ChatMessage) => void;
}

export function ChatMessageItem({
  message,
  onInspectCitation,
  onRetry,
}: ChatMessageItemProps) {
  const isUser = message.role === 'user';
  const isStreaming = message.status === 'streaming';
  const isError = message.status === 'error';
  const isAborted = message.status === 'aborted';

  return (
    <div
      data-status={message.status}
      data-role={message.role}
      className={`group w-full py-4 sm:py-5 px-3 sm:px-6 transition-colors ${
        isUser ? 'bg-transparent' : 'bg-slate-50/70 border-y border-slate-100'
      }`}
    >
      <div className="max-w-4xl mx-auto flex items-start gap-3 sm:gap-4">
        {/* Avatar */}
        <div
          className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium select-none shadow-2xs ${
            isUser
              ? 'bg-slate-800 text-white'
              : 'bg-indigo-600 text-white ring-2 ring-indigo-100'
          }`}
        >
          {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
        </div>

        {/* Message Body */}
        <div className="flex-1 min-w-0">
          {/* Header Info */}
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-semibold text-slate-800">
              {isUser ? 'Tu' : 'Assistente'}
            </span>
            {message.created_at && (
              <span className="text-[11px] text-slate-400">
                {new Date(message.created_at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}
            {isStreaming && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" />
                Elaborazione in corso...
              </span>
            )}
          </div>

          {/* Content */}
          {message.content ? (
            <div className="relative">
              <MarkdownRenderer content={message.content} />
              {isStreaming && (
                <span className="inline-block w-2 h-4 ml-1 bg-indigo-600 animate-pulse align-middle" />
              )}
            </div>
          ) : isStreaming ? (
            <div className="flex items-center gap-2 text-sm text-slate-500 italic py-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" />
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce delay-100" />
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce delay-200" />
              <span className="text-xs ml-1">In attesa dei primi token dal modello...</span>
            </div>
          ) : null}

          {/* Error Banner */}
          {isError && (
            <div role="alert" className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-red-800">Risposta interrotta da un errore</p>
                <p className="text-red-600 mt-0.5">
                  {message.error || 'La richiesta al server è fallita o il flusso è stato interrotto.'}
                </p>
                {onRetry && (
                  <button
                    onClick={() => onRetry(message)}
                    className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Riprova la domanda</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Aborted Banner */}
          {isAborted && (
            <div className="mt-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between gap-2 text-xs text-amber-800">
              <div className="flex items-center gap-2">
                <StopCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Generazione interrotta dall&apos;utente.</span>
              </div>
              {onRetry && (
                <button
                  onClick={() => onRetry(message)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-amber-900 hover:text-black font-semibold underline text-xs cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Riprova</span>
                </button>
              )}
            </div>
          )}

          {/* Citations / Related Documents */}
          {message.citations && message.citations.length > 0 && (
            <RelatedDocumentsSection
              citations={message.citations}
              onInspectCitation={onInspectCitation}
            />
          )}
        </div>
      </div>
    </div>
  );
}
