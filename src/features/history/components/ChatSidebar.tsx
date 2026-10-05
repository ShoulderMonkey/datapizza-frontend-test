'use client';

import React from 'react';
import type { ChatRecord } from '../types';
import {
  MessageSquare,
  Plus,
  Files,
  LogOut,
  RefreshCw,
  FolderOpen,
  User,
  PanelLeftClose,
  PanelLeft,
  AlertCircle,
} from 'lucide-react';

interface ChatSidebarProps {
  chats: ChatRecord[];
  activeChatId: string | null;
  isLoading: boolean;
  error: string | null;
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
  onRefreshChats: () => void;
  onOpenDocuments: () => void;
  onLogout: () => void;
  userId: string;
  isOpen: boolean;
  onToggleOpen: () => void;
  documentCount?: number | string;
  hasMoreChats?: boolean;
  isLoadingMoreChats?: boolean;
  loadMoreChatsError?: string | null;
  onLoadMoreChats?: () => void;
}

/**
 * Date of a history entry (`created_at`). Day and time, so that two questions asked on the same
 * day are distinguishable and the newest-first order is visible (ADR 0004).
 */
function formatEntryDate(createdAt: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return 'Sessione';
  return date.toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/**
 * Sidebar with the chat history. Each entry is one stored backend chat, i.e. one question/answer
 * pair (ADR 0004): title = `query`, date = `created_at`. The selected entry has `aria-current`.
 */
export function ChatSidebar({
  chats,
  activeChatId,
  isLoading,
  error,
  onSelectChat,
  onNewChat,
  onRefreshChats,
  onOpenDocuments,
  onLogout,
  userId,
  isOpen,
  onToggleOpen,
  documentCount,
  hasMoreChats = false,
  isLoadingMoreChats = false,
  loadMoreChatsError = null,
  onLoadMoreChats,
}: ChatSidebarProps) {
  // Both layouts stay mounted and CSS (`hidden`) picks one: toggling or the post-hydration viewport
  // update never unmounts the buttons (a remount detached them while e2e clicked them).
  return (
    <>
      <div
        data-sidebar="collapsed"
        hidden={isOpen}
        className={`${isOpen ? 'hidden' : 'hidden md:flex'} flex-col items-center py-3 px-2 bg-slate-900 border-r border-slate-800 text-slate-400 select-none`}
      >
        <button
          onClick={onToggleOpen}
          aria-label="Espandi barra laterale"
          className="p-2 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
          title="Espandi barra laterale"
        >
          <PanelLeft className="w-5 h-5" />
        </button>
        <button
          onClick={onNewChat}
          aria-label="Nuova conversazione"
          className="mt-4 p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer"
          title="Nuova chat"
        >
          <Plus className="w-5 h-5" />
        </button>
        <button
          onClick={onOpenDocuments}
          aria-label="Libreria documenti"
          className="mt-3 p-2 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
          title="Documenti PDF"
        >
          <Files className="w-5 h-5" />
        </button>
      </div>

      {/* Mobile overlay */}
      {/* Decorative backdrop: keyboard alternative = the "Chiudi barra laterale" button. */}
      <div
        aria-hidden="true"
        hidden={!isOpen}
        className={`${isOpen ? '' : 'hidden'} fixed inset-0 bg-slate-950/50 backdrop-blur-xs z-30 md:hidden`}
        onClick={onToggleOpen}
      />

      <aside
        data-sidebar="expanded"
        hidden={!isOpen}
        className={`${isOpen ? 'flex' : 'hidden'} fixed md:static inset-y-0 left-0 z-40 w-72 bg-slate-900 border-r border-slate-800 flex-col h-full text-slate-200 select-none`}
      >
        {/* Top Header */}
        <div className="p-3.5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-indigo-600 text-white rounded-lg font-bold text-xs shadow-xs">
              DF
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-tight">DocFact Chat</h1>
              <span className="text-[10px] text-slate-400 block -mt-0.5">Frontend Tech Test</span>
            </div>
          </div>
          <button
            onClick={onToggleOpen}
            aria-label="Chiudi barra laterale"
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Comprimi barra laterale"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        {/* Action Buttons: New Chat & Documents Library */}
        <div className="p-3 space-y-2 border-b border-slate-800/80">
          <button
            type="button"
            onClick={onNewChat}
            className="w-full py-2.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nuova conversazione</span>
          </button>

          <button
            type="button"
            onClick={onOpenDocuments}
            className="w-full py-2 px-3 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 text-slate-200 rounded-xl text-xs font-medium flex items-center justify-between transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-indigo-400" />
              <span>Documenti PDF</span>
            </div>
            {documentCount !== undefined && (
              <span className="px-1.5 py-0.2 rounded-full bg-slate-700 text-slate-300 text-[10px] font-mono">
                {documentCount}
              </span>
            )}
          </button>
        </div>

        {/* Chat History Section */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <div className="flex items-center justify-between px-2 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            <span>Cronologia Chat ({chats.length}{hasMoreChats ? '+' : ''})</span>
            <button
              onClick={onRefreshChats}
              disabled={isLoading}
              className="p-1 hover:text-white transition-colors cursor-pointer disabled:opacity-40"
              title="Aggiorna cronologia"
            >
              <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {isLoading && chats.length === 0 ? (
            <div role="status" className="py-8 text-center text-xs text-slate-500 space-y-2">
              <div aria-hidden="true" className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <span>Caricamento cronologia…</span>
            </div>
          ) : error ? (
            <div className="p-3 bg-red-950/40 border border-red-900/60 rounded-xl text-xs text-red-300 space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-red-200">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Errore cronologia</span>
              </div>
              <p className="text-[11px] text-red-400/90 leading-tight">{error}</p>
              <button
                onClick={onRefreshChats}
                className="mt-1 text-[11px] underline text-red-300 hover:text-white cursor-pointer"
              >
                Riprova
              </button>
            </div>
          ) : chats.length === 0 ? (
            <div className="py-8 text-center px-4 text-xs text-slate-500">
              <MessageSquare className="w-6 h-6 mx-auto mb-2 text-slate-600" />
              <p className="font-medium text-slate-400">Nessuna chat precedente</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Inizia una nuova conversazione per salvare la sessione sul server.
              </p>
            </div>
          ) : (
            chats.map((chat) => {
              const isActive = activeChatId === chat.id;
              return (
                <button
                  key={chat.id}
                  type="button"
                  onClick={() => onSelectChat(chat.id)}
                  aria-current={isActive ? 'true' : undefined}
                  data-testid="history-entry"
                  className={`w-full text-left p-2.5 rounded-xl text-xs transition-all flex items-start gap-2.5 cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600/25 border border-indigo-500/50 text-white font-medium shadow-2xs'
                      : 'text-slate-300 hover:bg-slate-800/80 hover:text-white border border-transparent'
                  }`}
                >
                  <MessageSquare
                    className={`w-4 h-4 shrink-0 mt-0.5 ${
                      isActive ? 'text-indigo-400' : 'text-slate-500'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate leading-snug">{chat.query}</p>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                      {chat.created_at ? (
                        <time dateTime={chat.created_at}>{formatEntryDate(chat.created_at)}</time>
                      ) : (
                        <span>Sessione</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}

          {!error && chats.length > 0 && loadMoreChatsError && (
            <p role="alert" className="px-2 text-[11px] text-red-400/90 leading-tight">
              {loadMoreChatsError}
            </p>
          )}
          {!error && chats.length > 0 && hasMoreChats && (
            <button
              type="button"
              onClick={onLoadMoreChats}
              disabled={isLoadingMoreChats}
              className="w-full mt-1 py-2 px-3 rounded-xl border border-slate-700/80 bg-slate-800/60 hover:bg-slate-800 text-slate-200 text-xs font-medium transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-default"
            >
              {isLoadingMoreChats ? 'Caricamento…' : 'Carica altre'}
            </button>
          )}
        </div>

        {/* Footer: User profile & Settings */}
        <div className="p-3 border-t border-slate-800 bg-slate-900/60 space-y-2">
          {/* User ID & Logout */}
          <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/60 border border-slate-700/60 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-full bg-slate-700 text-slate-200 flex items-center justify-center text-[10px] font-bold">
                <User className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <span className="font-mono text-slate-200 truncate block text-[11px]" title={userId}>
                  {userId}
                </span>
                <span className="text-[10px] text-emerald-400 block -mt-0.5">Cookie attivo</span>
              </div>
            </div>

            <button
              onClick={onLogout}
              className="p-1 text-slate-400 hover:text-red-400 rounded hover:bg-slate-700 transition-colors cursor-pointer"
              title="Esci (Logout)"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>
      </aside>
    </>
  );
}
