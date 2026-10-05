'use client';

import { ERROR_MESSAGES } from '@/src/api';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../queryKeys';
import React, { useEffect, useRef, useState } from 'react';
import { useDocuments } from '../hooks/useDocuments';
import { DocumentUploadDropzone } from './DocumentUploadDropzone';
import {
  FileText,
  X,
  RefreshCw,
  Eye,
  AlertCircle,
  Plus,
  FolderOpen,
} from 'lucide-react';

interface DocumentListModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPdfViewer: (documentId: string, filename: string) => void;
}

export function DocumentListModal({
  isOpen,
  onClose,
  onOpenPdfViewer,
}: DocumentListModalProps) {
  const [activeTab, setActiveTab] = useState<'list' | 'upload'>('list');
  // Upload outcome shown in the list tab: the dropzone unmounts on tab change, so it lives here.
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const {
    documents,
    isLoading,
    error,
    refresh: refreshDocuments,
    hasNextPage,
    isFetchingNextPage,
    loadMoreError,
    loadMore,
  } = useDocuments({ enabled: isOpen });
  const countLabel = `${documents.length}${hasNextPage ? '+' : ''}`;

  // Opening the library always revalidates the list. A request still in flight (started by the
  // workspace, possibly before the session changed) is cancelled first: react-query would
  // otherwise reuse it, and the user could see data older than the moment they opened the modal.
  const queryClient = useQueryClient();
  const refreshRef = useRef(refreshDocuments);
  refreshRef.current = refreshDocuments;
  useEffect(() => {
    if (!isOpen) return;
    void queryClient.cancelQueries({ queryKey: queryKeys.documents.list() }).then(() => refreshRef.current());
  }, [isOpen, queryClient]);

  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Escape closes the dialog; focus moves inside on open and returns to the opener on close.
  useEffect(() => {
    if (!isOpen) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (opener?.isConnected) opener.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="documents-dialog-title"
        tabIndex={-1}
        className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[85vh] outline-none"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 rounded-lg">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 id="documents-dialog-title" className="text-base font-bold text-slate-900 dark:text-slate-100">Libreria Documenti PDF</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Gestisci i file PDF utilizzati per il retrieval e fact-checking
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            aria-label="Chiudi"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-slate-200 dark:border-slate-700 px-6 bg-slate-50/50 dark:bg-slate-800/40">
          <button
            type="button"
            onClick={() => {
              setActiveTab('list');
              setUploadNotice(null);
            }}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'list'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-300'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100'
            }`}
          >
            <span>Documenti ({isLoading ? '…' : countLabel})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('upload');
              setUploadNotice(null);
            }}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'upload'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-300'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Carica nuovi PDF</span>
          </button>
        </div>

        {/* Body content */}
        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === 'upload' ? (
            <DocumentUploadDropzone
              onUploadSuccess={(message) => {
                setUploadNotice(message);
                refreshDocuments();
                setActiveTab('list');
              }}
            />
          ) : (
            <div className="space-y-3">
              <div role="status">
                {uploadNotice && (
                  <p className="px-3 py-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs text-emerald-800 dark:text-emerald-300">
                    {uploadNotice}
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                {isLoading ? (
                  <span role="status">Caricamento…</span>
                ) : (
                  <span>{countLabel} file disponibili sul backend</span>
                )}
                <button
                  type="button"
                  onClick={refreshDocuments}
                  disabled={isLoading}
                  className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-300 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>Aggiorna</span>
                </button>
              </div>

              {isLoading ? (
                <div className="py-12 text-center text-slate-500 dark:text-slate-400">
                  <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <span className="text-xs">Recupero documenti dal server...</span>
                </div>
              ) : error ? (
                <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-red-900 dark:text-red-200">{ERROR_MESSAGES.document_list_title}</p>
                    <p className="mt-0.5">{error}</p>
                    <button
                      onClick={refreshDocuments}
                      className="mt-2.5 px-3 py-1 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700 cursor-pointer"
                    >
                      Riprova
                    </button>
                  </div>
                </div>
              ) : documents.length === 0 ? (
                <div className="py-12 text-center bg-slate-50 dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 p-6">
                  <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Nessun documento presente</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                    Carica i documenti PDF di test del backend per abilitare il retrieval e le citazioni con bounding box.
                  </p>
                  <button
                    onClick={() => {
                      setActiveTab('upload');
                      setUploadNotice(null);
                    }}
                    className="mt-4 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs"
                  >
                    Carica subito PDF
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-xs">
                  {documents.map((doc) => {
                    const docId = doc.id;
                    return (
                      <div
                        key={docId}
                        className="p-3.5 flex items-center justify-between hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0 pr-3">
                          <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 rounded-lg shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate" title={doc.filename}>
                              {doc.filename}
                            </p>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              <span className="font-mono text-slate-500 dark:text-slate-400">ID: {docId.slice(0, 10)}...</span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onOpenPdfViewer(docId, doc.filename);
                          }}
                          className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                          title="Apri nel PDF fact-checking viewer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Visualizza PDF</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {!isLoading && !error && documents.length > 0 && loadMoreError && (
                <p role="alert" className="text-xs text-red-600 dark:text-red-400">{loadMoreError}</p>
              )}
              {!isLoading && !error && documents.length > 0 && hasNextPage && (
                <button
                  type="button"
                  onClick={() => void loadMore()}
                  disabled={isFetchingNextPage}
                  className="w-full py-2 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-default"
                >
                  {isFetchingNextPage ? 'Caricamento…' : 'Carica altri'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium transition-colors cursor-pointer"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}
