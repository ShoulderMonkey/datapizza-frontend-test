'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChatMessage, ChatSummary } from '@/types/chat';
import { CitationReference } from '@/types/citation';
import { chatService } from '@/services/chat-service';
import { documentService } from '@/services/document-service';
import { ChatSidebar } from './ChatSidebar';
import { ChatMessageItem } from './ChatMessageItem';
import { ChatComposer } from './ChatComposer';
import { PdfFactCheckViewer } from '../pdf/PdfFactCheckViewer';
import { DocumentListModal } from '../documents/DocumentListModal';
import { BackendConfigModal } from '../settings/BackendConfigModal';
import {
  FileText,
  PanelLeft,
  Sparkles,
  Layers,
  CheckCircle,
} from 'lucide-react';

interface ChatWorkspaceProps {
  userId: string;
  onLogout: () => void;
}

export function ChatWorkspace({ userId, onLogout }: ChatWorkspaceProps) {
  // Navigation & Modals
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isDocumentsOpen, setIsDocumentsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Active Fact-Checking PDF Viewer state
  const [activePdfViewer, setActivePdfViewer] = useState<{
    documentId: string;
    filename: string;
    pageNumber: number;
    citation: CitationReference | null;
    allCitations: CitationReference[];
  } | null>(null);

  // Conversation & Messages state
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);
  const [chatLoadError, setChatLoadError] = useState<string | null>(null);

  // Documents count
  const [documentCount, setDocumentCount] = useState<number | undefined>(undefined);

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = useRef<boolean>(true);

  // Auto-scroll logic
  const scrollToBottom = useCallback((smooth = true) => {
    if (shouldAutoScrollRef.current && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: smooth ? 'smooth' : 'auto',
        block: 'end',
      });
    }
  }, []);

  useEffect(() => {
    scrollToBottom(false);
  }, [messages, scrollToBottom]);

  // Load chat history & documents on mount
  const loadChatHistory = useCallback(async () => {
    try {
      const list = await chatService.listChats();
      setChats(list);
    } catch (err) {
      console.warn('Could not load chat history:', err);
    }
  }, []);

  const loadDocumentCount = useCallback(async () => {
    try {
      const docs = await documentService.listDocuments();
      setDocumentCount(docs.length);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    chatService.listChats()
      .then((list) => {
        if (isMounted) setChats(list);
      })
      .catch((err) => {
        console.warn('Could not load chat history:', err);
      });

    documentService.listDocuments()
      .then((docs) => {
        if (isMounted) setDocumentCount(docs.length);
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  // Cancel any active stream
  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      cancelStream();
    };
  }, [cancelStream]);

  // Select a chat from history
  const handleSelectChat = async (chatId: string) => {
    if (isStreaming) {
      cancelStream();
    }

    setActiveChatId(chatId);
    setIsChatLoading(true);
    setChatLoadError(null);

    try {
      const detail = await chatService.getChat(chatId);
      setMessages(detail.messages);
    } catch (err: unknown) {
      console.error('Failed to load chat details:', err);
      const msg = (err as Error)?.message || 'Impossibile caricare i messaggi della conversazione.';
      setChatLoadError(msg);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Start a new conversation
  const handleNewChat = () => {
    if (isStreaming) {
      cancelStream();
    }
    setActiveChatId(null);
    setMessages([]);
    setChatLoadError(null);
  };

  // Send a message and stream response via NDJSON
  const handleSendMessage = async (queryText: string) => {
    if (isStreaming) return;

    // Create user message
    const userMessageId = `msg-user-${Date.now()}`;
    const userMessage: ChatMessage = {
      id: userMessageId,
      role: 'user',
      content: queryText,
      status: 'completed',
      created_at: new Date().toISOString(),
    };

    // Placeholder assistant message
    const assistantMessageId = `msg-asst-${Date.now() + 1}`;
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      status: 'streaming',
      created_at: new Date().toISOString(),
      citations: [],
    };

    const updatedMessages = [...messages, userMessage, assistantMessage];
    setMessages(updatedMessages);
    setIsStreaming(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Build history for backend request
    const historyPayload = messages
      .filter((m) => m.status === 'completed' && m.content)
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));

    let accumulatedContent = '';
    const collectedCitations: CitationReference[] = [];

    try {
      const stream = chatService.streamQuery(
        {
          query: queryText,
          history: historyPayload.length > 0 ? historyPayload : undefined,
          chat_id: activeChatId || undefined,
        },
        abortController.signal
      );

      for await (const chunk of stream) {
        if (chunk.type === 'content') {
          accumulatedContent += chunk.delta;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: accumulatedContent }
                : msg
            )
          );
        } else if (chunk.type === 'citations') {
          if (Array.isArray(chunk.references)) {
            collectedCitations.push(...chunk.references);
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? { ...msg, citations: [...collectedCitations] }
                  : msg
              )
            );
          }
        } else if (chunk.type === 'error') {
          const errMsg = chunk.error || chunk.message || 'Errore generato dal chatbot.';
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? {
                    ...msg,
                    status: 'error',
                    error: errMsg,
                    content: accumulatedContent,
                    citations: collectedCitations,
                  }
                : msg
            )
          );
        }
      }

      // Finalize message as completed
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                status: 'completed',
                content: accumulatedContent,
                citations: collectedCitations,
              }
            : msg
        )
      );

      // Refresh chat list to show newly created or updated chat
      loadChatHistory();
    } catch (err: unknown) {
      const isAbort = (err as Error)?.name === 'AbortError';
      if (isAbort) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  status: 'aborted',
                  content: accumulatedContent,
                  citations: collectedCitations,
                }
              : msg
          )
        );
      } else {
        console.error('Chat streaming failed:', err);
        const errorText =
          (err as Error)?.message || 'La risposta si è interrotta. Puoi riprovare.';
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  status: 'error',
                  error: errorText,
                  content: accumulatedContent,
                  citations: collectedCitations,
                }
              : msg
          )
        );
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  // Retry a failed or interrupted query
  const handleRetry = (msg: ChatMessage) => {
    // Find preceding user query
    const index = messages.findIndex((m) => m.id === msg.id);
    let queryToRetry = '';

    if (index > 0 && messages[index - 1].role === 'user') {
      queryToRetry = messages[index - 1].content;
      // Remove failed assistant message
      setMessages((prev) => prev.filter((m) => m.id !== msg.id));
    } else {
      queryToRetry = msg.content;
    }

    if (queryToRetry) {
      handleSendMessage(queryToRetry);
    }
  };

  // Inspect citation in PDF fact-checking viewer
  const handleInspectCitation = (citation: CitationReference) => {
    // Gather all citations in the current conversation that belong to this document
    const allDocCitations: CitationReference[] = [];
    messages.forEach((m) => {
      m.citations?.forEach((c) => {
        if (c.document_id === citation.document_id) {
          allDocCitations.push(c);
        }
      });
    });

    setActivePdfViewer({
      documentId: citation.document_id,
      filename: citation.filename || `Doc-${citation.document_id}`,
      pageNumber: citation.page_number || 1,
      citation: citation,
      allCitations: allDocCitations.length > 0 ? allDocCitations : [citation],
    });
  };

  // Open PDF viewer directly from Document Library
  const handleOpenPdfDirectly = (documentId: string, filename: string) => {
    setActivePdfViewer({
      documentId,
      filename,
      pageNumber: 1,
      citation: null,
      allCitations: [],
    });
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white text-slate-900 font-sans">
      {/* Left Sidebar */}
      <ChatSidebar
        chats={chats}
        activeChatId={activeChatId}
        isLoading={false}
        error={null}
        onSelectChat={handleSelectChat}
        onNewChat={handleNewChat}
        onRefreshChats={loadChatHistory}
        onOpenDocuments={() => setIsDocumentsOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onLogout={onLogout}
        userId={userId}
        isOpen={isSidebarOpen}
        onToggleOpen={() => setIsSidebarOpen(!isSidebarOpen)}
        documentCount={documentCount}
      />

      {/* Main Conversation Area */}
      <main className="flex-1 flex flex-col h-full min-w-0 bg-white relative">
        {/* Top Navbar */}
        <header className="h-14 border-b border-slate-200/80 px-4 flex items-center justify-between bg-white/80 backdrop-blur-xs select-none z-10 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {!isSidebarOpen && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                title="Espandi barra laterale"
              >
                <PanelLeft className="w-5 h-5" />
              </button>
            )}

            <div className="min-w-0">
              <h2 className="text-sm font-bold text-slate-900 truncate flex items-center gap-2">
                <span>
                  {activeChatId
                    ? chats.find((c) => c.id === activeChatId)?.title || 'Conversazione'
                    : 'Nuova sessione'}
                </span>
                {isStreaming && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                )}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsDocumentsOpen(true)}
              className="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Libreria PDF</span>
              {typeof documentCount === 'number' && (
                <span className="bg-indigo-200/80 text-indigo-900 px-1 rounded-full text-[10px]">
                  {documentCount}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Message List or Welcome State */}
        <div
          className="flex-1 overflow-y-auto"
          onScroll={(e) => {
            const target = e.currentTarget;
            const isNearBottom =
              target.scrollHeight - target.scrollTop - target.clientHeight < 120;
            shouldAutoScrollRef.current = isNearBottom;
          }}
        >
          {isChatLoading ? (
            <div className="py-20 text-center space-y-3">
              <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm font-medium text-slate-600">Caricamento conversazione in corso...</p>
            </div>
          ) : chatLoadError ? (
            <div className="max-w-md mx-auto my-12 p-6 bg-red-50 border border-red-200 rounded-2xl text-center space-y-3">
              <p className="text-sm font-semibold text-red-800">Errore di caricamento</p>
              <p className="text-xs text-red-600">{chatLoadError}</p>
              <button
                onClick={() => activeChatId && handleSelectChat(activeChatId)}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium cursor-pointer"
              >
                Riprova a caricare
              </button>
            </div>
          ) : messages.length === 0 ? (
            <div className="max-w-2xl mx-auto py-12 sm:py-20 px-4 text-center select-none">
              <div className="inline-flex p-4 bg-indigo-50 text-indigo-600 rounded-3xl mb-4 shadow-sm ring-1 ring-indigo-100">
                <Sparkles className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                Benvenuto in DocFact Assistant
              </h2>
              <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto leading-relaxed">
                Poni domande sui documenti PDF caricati. L&apos;assistente genera risposte verificate in streaming NDJSON con citazioni esatte e regioni visive evidenziate.
              </p>

              {/* Quick suggestions / cards */}
              <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
                <div
                  onClick={() => setIsDocumentsOpen(true)}
                  className="p-3.5 bg-slate-50 hover:bg-indigo-50/50 border border-slate-200 hover:border-indigo-300 rounded-xl transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-2 font-semibold text-xs text-slate-800 group-hover:text-indigo-600 mb-1">
                    <FileText className="w-4 h-4 text-indigo-500" />
                    <span>1. Carica PDF</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    Carica i documenti di test del backend tramite multipart/form-data.
                  </p>
                </div>

                <div
                  onClick={() => handleSendMessage('Quali sono i punti principali trattati nei documenti caricati?')}
                  className="p-3.5 bg-slate-50 hover:bg-indigo-50/50 border border-slate-200 hover:border-indigo-300 rounded-xl transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-2 font-semibold text-xs text-slate-800 group-hover:text-indigo-600 mb-1">
                    <Layers className="w-4 h-4 text-indigo-500" />
                    <span>2. Fai una domanda</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    &quot;Quali sono i punti principali trattati nei documenti?&quot;
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex items-center gap-2 font-semibold text-xs text-slate-800 mb-1">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    <span>3. Verifica Bounding Box</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    I box in pollici <code className="bg-slate-200 px-1 rounded text-[10px]">rects_in</code> vengono visualizzati graficamente sulla pagina PDF esatta.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="pb-4">
              {messages.map((message) => (
                <ChatMessageItem
                  key={message.id}
                  message={message}
                  onInspectCitation={handleInspectCitation}
                  onRetry={handleRetry}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Composer at Bottom */}
        <div className="shrink-0 bg-white border-t border-slate-100 pt-3">
          <ChatComposer
            onSendMessage={handleSendMessage}
            onCancelStream={cancelStream}
            isStreaming={isStreaming}
          />
        </div>
      </main>

      {/* PDF Fact-Checking Modal/Viewer */}
      {activePdfViewer && (
        <PdfFactCheckViewer
          documentId={activePdfViewer.documentId}
          filename={activePdfViewer.filename}
          initialPage={activePdfViewer.pageNumber}
          citations={activePdfViewer.allCitations}
          activeCitation={activePdfViewer.citation}
          onClose={() => setActivePdfViewer(null)}
          onSelectCitation={(cit) => {
            setActivePdfViewer((prev) => (prev ? { ...prev, citation: cit } : null));
          }}
        />
      )}

      {/* Document Library Modal */}
      <DocumentListModal
        isOpen={isDocumentsOpen}
        onClose={() => {
          setIsDocumentsOpen(false);
          loadDocumentCount();
        }}
        onOpenPdfViewer={handleOpenPdfDirectly}
      />

      {/* Backend Settings Modal */}
      <BackendConfigModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onConfigChanged={() => {
          loadChatHistory();
          loadDocumentCount();
        }}
      />
    </div>
  );
}
