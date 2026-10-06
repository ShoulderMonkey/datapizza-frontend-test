'use client';

import React, { useRef, useEffect, useState } from 'react';
import { QUERY_MAX_LENGTH, ERROR_MESSAGES } from '@/src/api';
import { Send, Square, AlertCircle } from 'lucide-react';

interface ChatComposerProps {
  onSendMessage: (query: string) => void;
  onCancelStream: () => void;
  isStreaming: boolean;
  disabled?: boolean;
}

export function ChatComposer({
  onSendMessage,
  onCancelStream,
  isStreaming,
  disabled = false,
}: ChatComposerProps) {
  const [query, setQuery] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const overLimit = query.length > QUERY_MAX_LENGTH;
  const nearLimit = query.length > QUERY_MAX_LENGTH * 0.9;

  // Auto-resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 180)}px`;
    }
  }, [query]);

  // Focus on mount only. The textarea is never `disabled` during a stream (it would lose focus),
  // so after sending the focus stays on it and at the end of the stream it is not moved.
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // When the stream ends while the "Interrompi" button had focus, the button is unmounted and the
  // focus would fall back to <body>: hand it to the textarea (P1-12).
  const wasStreamingRef = useRef(false);
  useEffect(() => {
    if (wasStreamingRef.current && !isStreaming) {
      const active = document.activeElement;
      if (!active || active === document.body || active === document.documentElement) textareaRef.current?.focus();
    }
    wasStreamingRef.current = isStreaming;
  }, [isStreaming]);

  const handleCancel = () => {
    // Move focus first, synchronously, while the button still exists (the textarea is readOnly,
    // not disabled, during a stream: ADR 0003), so the result is deterministic.
    textareaRef.current?.focus();
    onCancelStream();
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    // ADR 0003: no new send while a stream is active (the Stop button replaces Send).
    if (isStreaming || disabled) return;
    const trimmed = query.trim();

    if (trimmed.length > QUERY_MAX_LENGTH) {
      setValidationError(ERROR_MESSAGES.query_too_long);
      return;
    }

    if (!trimmed) {
      setValidationError('Inserisci una domanda prima di inviare.');
      return;
    }

    setValidationError(null);
    onSendMessage(trimmed);
    setQuery('');

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 pb-4">
      {validationError && (
        <div className="mb-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-md flex items-center gap-1.5 text-xs text-amber-800 dark:text-amber-300 animate-in fade-in duration-150">
          <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="relative bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 focus-within:border-indigo-600 focus-within:ring-2 focus-within:ring-indigo-100 dark:focus-within:ring-indigo-900 rounded-2xl shadow-sm transition-all"
      >
        <textarea
          ref={textareaRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (validationError) setValidationError(null);
          }}
          onKeyDown={handleKeyDown}
          // ADR 0003: the send is blocked during a stream (handleSubmit), but the field is
          // `readOnly` + `aria-disabled` instead of `disabled` so keyboard focus is not lost.
          readOnly={isStreaming}
          disabled={disabled}
          aria-disabled={disabled || isStreaming ? 'true' : undefined}
          aria-label="Domanda sui documenti"
          aria-describedby={`composer-shortcuts-hint${nearLimit ? ' composer-counter' : ''}`}
          aria-invalid={overLimit ? 'true' : undefined}
          rows={1}
          placeholder={
            isStreaming
              ? "L'assistente sta rispondendo..."
              : 'Fai una domanda...'
          }
          className="w-full pl-3 pr-12 py-3.5 bg-transparent resize-none outline-none text-slate-800 dark:text-slate-100 placeholder-slate-400 text-sm leading-relaxed max-h-48 overflow-y-auto disabled:opacity-60 read-only:opacity-60"
        />

        <div className="absolute right-2.5 bottom-2.5">
          {isStreaming ? (
            <button
              key="cancel"
              type="button"
              onClick={handleCancel}
              className="p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 dark:focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900 rounded-xl bg-slate-900 text-white hover:bg-red-600 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-medium shadow-sm"
              title="Interrompi risposta"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span className="hidden sm:inline pr-1">Interrompi</span>
            </button>
          ) : (
            <button
              key="send"
              type="submit"
              disabled={disabled || !query.trim() || overLimit}
              className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-slate-700 disabled:text-slate-400 text-white transition-all cursor-pointer disabled:cursor-not-allowed shadow-sm hover:shadow"
              title="Invia messaggio"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
      </form>

      {nearLimit && (
        <div
          id="composer-counter"
          role={overLimit ? 'alert' : undefined}
          className={`mt-1 text-right text-[11px] ${overLimit ? 'text-red-700 dark:text-red-400 font-semibold' : 'text-slate-600 dark:text-slate-400'}`}
        >
          {query.length}/{QUERY_MAX_LENGTH} caratteri
          {overLimit && ` · ${ERROR_MESSAGES.query_too_long}`}
        </div>
      )}

      <div id="composer-shortcuts-hint" className="mt-2 text-center text-[11px] text-slate-600 dark:text-slate-400">
        Invio per inviare, Shift+Invio per a capo.
      </div>
    </div>
  );
}
