'use client';

import React from 'react';
import { CheckCircle, FileText, Layers, Sparkles } from 'lucide-react';

export const SUGGESTED_QUESTION = 'Quali sono i punti principali trattati nei documenti caricati?';

interface WelcomePanelProps {
  onOpenDocuments: () => void;
  onAskQuestion: (question: string) => void;
}

/** Empty state of a new conversation. */
export function WelcomePanel({ onOpenDocuments, onAskQuestion }: WelcomePanelProps) {
  return (
    <div className="max-w-2xl mx-auto py-12 sm:py-20 px-4 text-center select-none">
      <div className="inline-flex p-4 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 rounded-3xl mb-4 shadow-sm ring-1 ring-indigo-100 dark:ring-indigo-900">
        <Sparkles className="w-8 h-8" />
      </div>
      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
        Benvenuto in DocFact Assistant
      </h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-md mx-auto leading-relaxed">
        Fai una domanda sui tuoi documenti PDF: le risposte riportano le fonti e mostrano il punto esatto nel documento.
      </p>

      {/* Quick suggestions / cards */}
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
        <button
          type="button"
          onClick={onOpenDocuments}
          className="text-left p-3.5 bg-slate-50 dark:bg-slate-900 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/40 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500 rounded-xl transition-all cursor-pointer group"
        >
          <span className="flex items-center gap-2 font-semibold text-xs text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 mb-1">
            <FileText className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
            <span>1. Carica PDF</span>
          </span>
          <span className="block text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
            Carica i PDF su cui vuoi fare domande.
          </span>
        </button>

        <button
          type="button"
          onClick={() => onAskQuestion(SUGGESTED_QUESTION)}
          className="text-left p-3.5 bg-slate-50 dark:bg-slate-900 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/40 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500 rounded-xl transition-all cursor-pointer group"
        >
          <span className="flex items-center gap-2 font-semibold text-xs text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 mb-1">
            <Layers className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
            <span>2. Fai una domanda</span>
          </span>
          <span className="block text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
            &quot;Quali sono i punti principali trattati nei documenti?&quot;
          </span>
        </button>

        <div className="p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl">
          <div className="flex items-center gap-2 font-semibold text-xs text-slate-800 dark:text-slate-100 mb-1">
            <CheckCircle className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
            <span>3. Controlla le fonti</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
            Apri una citazione per vedere il passaggio evidenziato nella pagina del PDF.
          </p>
        </div>
      </div>
    </div>
  );
}
