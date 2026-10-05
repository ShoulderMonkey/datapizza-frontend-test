'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DocumentListModal } from '@/src/features/documents/components/DocumentListModal';
import { useDocuments } from '@/src/features/documents/hooks/useDocuments';
import { CitationHighlightProvider } from '@/src/features/factcheck/hooks/useCitationHighlight';
import { FactCheckPanel } from '@/src/features/factcheck/components/FactCheckPanel';
import { usePdfViewer } from '@/src/features/factcheck/hooks/usePdfViewer';
import { ChatSidebar } from '@/src/features/history/components/ChatSidebar';
import { HistoryEntryNotice } from '@/src/features/history/components/HistoryEntryNotice';
import { HistorySavedStatus } from '@/src/features/history/components/HistorySavedStatus';
import { useChatHistory } from '@/src/features/history/hooks/useChatHistory';
import { useSavedChat } from '@/src/features/history/hooks/useSavedChat';
import { useSidebarOpen } from '@/src/features/history/hooks/useSidebarOpen';
import { useAutoScroll } from '../hooks/useAutoScroll';
import { useChatStream, type StreamEndResult } from '../hooks/useChatStream';
import type { ChatMessage, CitationReference } from '../types';
import { ChatComposer } from './ChatComposer';
import { ChatConversation } from './ChatConversation';
import { ChatHeader } from './ChatHeader';
import { WelcomePanel } from './WelcomePanel';

interface ChatWorkspaceProps {
  userId: string;
  onLogout: () => void;
}

/** A stored transcript is read-only: its messages enter the conversation as `completed`. */
const toCompletedMessages = (messages: readonly Omit<ChatMessage, 'status'>[]): ChatMessage[] =>
  messages.map((m): ChatMessage => ({ ...m, status: 'completed' }));

const NO_IDS: ReadonlySet<string> = new Set();

/**
 * Layout of the authenticated app. It only wires hooks (history, documents, stream,
 * PDF panel) to presentational components: no API calls and no stream logic here.
 *
 * History model (ADR 0004): a backend chat is one immutable question/answer pair, shown as a
 * history entry (title = `query`, date = `created_at`). The multi-turn conversation is local only.
 * - Selecting an entry shows its Q/A (and saved citations) and highlights it (`aria-current`).
 * - Sending (or retrying) while an entry is selected starts a new local session: the selection is
 *   cleared, the entry's Q/A stays on screen labelled "Dalla conversazione precedente" and is sent
 *   in `history` (ignored by the backend), and the backend stores a new chat. The selected entry is
 *   never modified.
 * - At the end of a successful stream the list is refetched and the new entry appears on top,
 *   marked as current (`aria-current`) but not selected, with a `role="status"` announcement
 *   (ADR 0007, modifies ADR 0004 point 5). The stream does not return the chat id, so the entry is
 *   the one absent from the snapshot taken at send time with the same `query` (`useSavedChat`).
 *   It is not selected: selecting would load its transcript and replace the local multi-turn
 *   conversation with a single Q/A pair. Clicking it selects it as usual; a new send, "Nuova
 *   conversazione", the selection of an entry, Stop or logout reset the mark.
 */
export function ChatWorkspace({ userId, onLogout }: ChatWorkspaceProps) {
  const { isOpen: isSidebarOpen, setOpen: setIsSidebarOpen, toggle: toggleSidebar } = useSidebarOpen();
  const [isDocumentsOpen, setIsDocumentsOpen] = useState(false);
  /** Ids of the stored messages kept as context of a new local session (ADR 0004 point 3). */
  const [contextIds, setContextIds] = useState<ReadonlySet<string>>(NO_IDS);

  const history = useChatHistory();
  const documents = useDocuments({ enabled: true });
  const pdfViewer = usePdfViewer();
  const savedChat = useSavedChat({ chats: history.chats, refresh: history.refresh });
  const { complete: completeSavedChat, begin: beginSavedChat, clear: clearSavedChat } = savedChat;
  const handleStreamEnd = useCallback(
    (result: StreamEndResult) => void completeSavedChat(result),
    [completeSavedChat]
  );
  const chat = useChatStream({ onStreamEnd: handleStreamEnd });
  const { endRef, onScroll } = useAutoScroll(chat.messages);

  // Only the first page may be loaded: with more pages the count is a lower bound ("20+").
  const documentCount = documents.hasLoaded
    ? `${documents.documents.length}${documents.hasNextPage ? '+' : ''}`
    : undefined;

  // The transcript belongs to the chat selected last (query key = chat id), so a slow response
  // for a superseded chat can never overwrite the visible conversation.
  const { activeChatId, transcript } = history;
  const { replaceMessages } = chat;
  useEffect(() => {
    if (activeChatId && transcript) {
      replaceMessages(toCompletedMessages(transcript.messages));
    }
  }, [activeChatId, transcript, replaceMessages]);

  // Switching chat (or starting a new one) aborts the running stream: `cancel()` stops it now,
  // and `replaceMessages()` aborts too, so a stream can never write into another conversation.
  const handleSelectChat = (chatId: string) => {
    clearSavedChat();
    setContextIds(NO_IDS);
    if (chatId === activeChatId && transcript) {
      // Re-selecting the entry restores its stored Q/A (and aborts a running stream).
      replaceMessages(toCompletedMessages(transcript.messages));
      return;
    }
    // The previous conversation is dropped right away: while the entry loads (or if it fails)
    // its messages are neither shown under the new selection nor sent as `history`.
    replaceMessages([]);
    history.selectChat(chatId);
  };

  const handleNewChat = () => {
    chat.cancel();
    clearSavedChat();
    setContextIds(NO_IDS);
    history.clearActiveChat();
    chat.replaceMessages([]);
  };

  // An aborted stream stores nothing: no announcement and no marked entry.
  const handleCancelStream = () => {
    chat.cancel();
    clearSavedChat();
  };

  const handleLogout = () => {
    clearSavedChat();
    onLogout();
  };

  // Stable callback: memoized message rows do not re-render when the conversation changes.
  const { inspectCitation } = pdfViewer;
  const { getConversationCitations } = chat;
  const handleInspectCitation = useCallback(
    (citation: CitationReference) => inspectCitation(citation, getConversationCitations()),
    [inspectCitation, getConversationCitations]
  );

  const isViewingHistoryEntry =
    activeChatId !== null && transcript !== undefined && !history.isChatLoading && !history.chatLoadError;

  // Messages of the selected entry: while it is viewed, and as labelled context after a new question.
  const transcriptIds = useMemo(
    () => (transcript ? new Set(transcript.messages.map((m) => m.id)) : NO_IDS),
    [transcript]
  );
  // ADR 0004: a new question never modifies the selected entry. The selection is cleared so the
  // sidebar no longer marks it as the current conversation; its messages stay as labelled context
  // (ADR 0007), and the ids of the loaded entries are snapshotted to find the new one at the end.
  const { clearActiveChat } = history;
  const { send, retry, isStreaming } = chat;
  const startNewQuestion = useCallback(() => {
    if (isViewingHistoryEntry) setContextIds(transcriptIds);
    beginSavedChat();
    clearActiveChat();
  }, [isViewingHistoryEntry, transcriptIds, beginSavedChat, clearActiveChat]);

  const handleSend = (query: string) => {
    if (isStreaming) return; // ADR 0003: no send during a stream.
    startNewQuestion();
    void send(query);
  };

  // Stable callback (memoized rows); a retry is a new send, so it follows the same rule.
  const handleRetry = useCallback(
    (message: ChatMessage) => {
      startNewQuestion();
      retry(message);
    },
    [startNewQuestion, retry]
  );

  // The sidebar marks the selected entry or, when nothing is selected, the entry just saved.
  const currentChatId = history.activeChatId ?? savedChat.savedChatId;

  return (
    <CitationHighlightProvider>
    <div className="flex h-screen w-screen overflow-hidden bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans">
      <ChatSidebar
        chats={history.chats}
        activeChatId={currentChatId}
        isLoading={history.isListLoading}
        error={history.listError}
        onSelectChat={handleSelectChat}
        onNewChat={handleNewChat}
        onRefreshChats={history.refresh}
        onOpenDocuments={() => setIsDocumentsOpen(true)}
        onLogout={handleLogout}
        userId={userId}
        isOpen={isSidebarOpen}
        onToggleOpen={toggleSidebar}
        documentCount={documentCount}
        hasMoreChats={history.hasMoreChats}
        isLoadingMoreChats={history.isLoadingMoreChats}
        loadMoreChatsError={history.loadMoreChatsError}
        onLoadMoreChats={history.loadMoreChats}
      />

      <main className="flex-1 flex flex-col h-full min-w-0 xl:min-w-[480px] bg-white dark:bg-slate-900 relative">
        <ChatHeader
          title={history.activeChatTitle}
          isStreaming={chat.isStreaming}
          isSidebarOpen={isSidebarOpen}
          onOpenSidebar={() => setIsSidebarOpen(true)}
          onOpenDocuments={() => setIsDocumentsOpen(true)}
          documentCount={documentCount}
        />

        <ChatConversation
          messages={chat.messages}
          isStreaming={isStreaming}
          isLoading={history.isChatLoading}
          loadError={history.chatLoadError}
          onRetryLoad={() => void history.reloadChat()}
          onInspectCitation={handleInspectCitation}
          activeCitation={pdfViewer.target?.citation}
          // ADR 0003: no new send during a stream, so "Riprova" is hidden until it ends.
          onRetry={isStreaming ? undefined : handleRetry}
          endRef={endRef}
          onScroll={onScroll}
          emptyState={
            <WelcomePanel onOpenDocuments={() => setIsDocumentsOpen(true)} onAskQuestion={handleSend} />
          }
          entryMessageIds={isViewingHistoryEntry ? transcriptIds : contextIds}
          isEntryContext={!isViewingHistoryEntry && contextIds.size > 0}
        />

        <div className="shrink-0 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 pt-3">
          {isViewingHistoryEntry && <HistoryEntryNotice />}
          {savedChat.state.status !== 'idle' && (
            <HistorySavedStatus isSaved={savedChat.state.status === 'saved'} />
          )}
          <ChatComposer
            onSendMessage={handleSend}
            onCancelStream={handleCancelStream}
            isStreaming={chat.isStreaming}
            disabled={history.isChatLoading}
          />
        </div>
      </main>

      {pdfViewer.target && (
        <FactCheckPanel
          target={pdfViewer.target}
          onClose={pdfViewer.close}
          onSelectCitation={pdfViewer.selectCitation}
        />
      )}

      <DocumentListModal
        isOpen={isDocumentsOpen}
        onClose={() => setIsDocumentsOpen(false)}
        onOpenPdfViewer={pdfViewer.openDocument}
      />
    </div>
    </CitationHighlightProvider>
  );
}
