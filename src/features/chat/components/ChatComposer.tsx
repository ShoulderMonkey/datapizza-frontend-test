'use client';

import React, { useRef, useEffect, useState } from 'react';
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

  // Auto-resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 180)}px`;
    }
  }, [query]);

  // Focus on mount or when stream finishes
  useEffect(() => {
    if (!isStreaming && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isStreaming]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = query.trim();

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
        <div className="mb-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-md flex items-center gap-1.5 text-xs text-amber-800 animate-in fade-in duration-150">
          <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="relative bg-white border border-slate-300 focus-within:border-indigo-600 focus-within:ring-2 focus-within:ring-indigo-100 rounded-2xl shadow-sm transition-all"
      >
        <textarea
          ref={textareaRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (validationError) setValidationError(null);
          }}
          onKeyDown={handleKeyDown}
          disabled={disabled || isStreaming}
          rows={1}
          placeholder={
            isStreaming
              ? "L'assistente sta rispondendo..."
              : 'Fai una domanda sui documenti caricati... (Invio per inviare, Shift+Invio per a capo)'
          }
          className="w-full pl-4 pr-14 py-3.5 bg-transparent resize-none outline-none text-slate-800 placeholder-slate-400 text-sm leading-relaxed max-h-48 overflow-y-auto disabled:opacity-60"
        />

        <div className="absolute right-2.5 bottom-2.5">
          {isStreaming ? (
            <button
              type="button"
              onClick={onCancelStream}
              className="p-2 rounded-xl bg-slate-900 text-white hover:bg-red-600 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-medium shadow-sm"
              title="Interrompi risposta"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span className="hidden sm:inline pr-1">Interrompi</span>
            </button>
          ) : (
            <button
              type="submit"
              disabled={disabled || !query.trim()}
              className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white transition-all cursor-pointer disabled:cursor-not-allowed shadow-sm hover:shadow"
              title="Invia messaggio"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
      </form>

      <div className="mt-2 text-center text-[11px] text-slate-400">
        Le risposte sono groundate sui PDF tramite streaming NDJSON e verificate con bounding region.
      </div>
    </div>
  );
}
