'use client';

import React from 'react';
import { FileText, PanelLeft } from 'lucide-react';

interface ChatHeaderProps {
  title: string;
  isStreaming: boolean;
  isSidebarOpen: boolean;
  onOpenSidebar: () => void;
  onOpenDocuments: () => void;
  documentCount?: number | string;
}

export function ChatHeader({
  title,
  isStreaming,
  isSidebarOpen,
  onOpenSidebar,
  onOpenDocuments,
  documentCount,
}: ChatHeaderProps) {
  return (
    <header className="@container h-14 border-b border-slate-200/80 dark:border-slate-700/80 px-4 flex items-center justify-between bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs select-none z-10 shrink-0">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {!isSidebarOpen && (
          <button
            type="button"
            onClick={onOpenSidebar}
            aria-label="Espandi barra laterale"
            className="md:hidden p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 transition-colors cursor-pointer"
            title="Espandi barra laterale"
          >
            <PanelLeft className="w-5 h-5" />
          </button>
        )}

        <div className="min-w-0">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate flex items-center gap-2">
            <span className="min-w-0 truncate">{title}</span>
            {isStreaming && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />}
          </h2>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={onOpenDocuments}
          className="px-2.5 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <FileText className="w-3.5 h-3.5" />
          <span className="sr-only @md:not-sr-only">Libreria PDF</span>
          {documentCount !== undefined && (
            <span className="bg-indigo-200/80 dark:bg-indigo-800/60 text-indigo-900 dark:text-indigo-200 px-1 rounded-full text-[10px]">
              {documentCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
