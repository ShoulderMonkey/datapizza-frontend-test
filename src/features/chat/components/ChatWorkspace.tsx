'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { DocumentListModal } from '@/src/features/documents/components/DocumentListModal';
import { useDocuments } from '@/src/features/documents/hooks/useDocuments';
import { FactCheckPanel } from '@/src/features/factcheck/components/FactCheckPanel';
import { usePdfViewer } from '@/src/features/factcheck/hooks/usePdfViewer';
import { ChatSidebar } from '@/src/features/history/components/ChatSidebar';
import { HistoryEntryNotice } from '@/src/features/history/components/HistoryEntryNotice';
import { useChatHistory } from '@/src/features/history/hooks/useChatHistory';
import { useAutoScroll } from '../hooks/useAutoScroll';
import { useChatStream } from '../hooks/useChatStream';
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

/**
 * Layout of the authenticated app. It only wires hooks (history, documents, stream,
 * PDF panel) to presentational components: no API calls and no stream logic here.
 *
 * History model (ADR 0004): a backend chat is one immutable question/answer pair, shown as a
 * history entry (title = `query`, date = `created_at`). The multi-turn conversation is local only.
 * - Selecting an entry shows its Q/A (and saved citations) and highlights it (`aria-current`).
 * - Sending (or retrying) while an entry is selected starts a new local session: the selection is
 *   cleared, the entry's Q/A stays on screen and is sent in `history` (ignored by the backend),
 *   and the backend stores a new chat. The selected entry is never modified.
 * - At the end of the stream the list is refetched and the new entry appears on top, not selected:
 *   the stream does not return the chat id, and selecting it would replace the local multi-turn
 *   conversation with a single Q/A pair.
 */
export function ChatWorkspace({ userId, onLogout }: ChatWorkspaceProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isDocumentsOpen, setIsDocumentsOpen] = useState(false);

  const history = useChatHistory();
  const documents = useDocuments({ enabled: true });
  const pdfViewer = usePdfViewer();
  const chat = useChatStream({ onStreamEnd: history.refresh });
  const { endRef, onScroll } = useAutoScroll(chat.messages);

  const documentCount = documents.hasLoaded ? documents.documents.length : undefined;

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
    history.clearActiveChat();
    chat.replaceMessages([]);
  };

  // Stable callback: memoized message rows do not re-render when the conversation changes.
  const { inspectCitation } = pdfViewer;
  const { getConversationCitations } = chat;
  const handleInspectCitation = useCallback(
    (citation: CitationReference) => inspectCitation(citation, getConversationCitations()),
    [inspectCitation, getConversationCitations]
  );

  // ADR 0004: a new question never modifies the selected entry. The selection is cleared so the
  // sidebar no longer marks it as the current conversation; the backend stores a new chat.
  const { clearActiveChat } = history;
  const { send, retry, isStreaming } = chat;
  const handleSend = (query: string) => {
    if (isStreaming) return; // ADR 0003: no send during a stream.
    clearActiveChat();
    void send(query);
  };

  // Stable callback (memoized rows); a retry is a new send, so it follows the same rule.
  const handleRetry = useCallback(
    (message: ChatMessage) => {
      clearActiveChat();
      retry(message);
    },
    [clearActiveChat, retry]
  );

  const isViewingHistoryEntry =
    activeChatId !== null && transcript !== undefined && !history.isChatLoading && !history.chatLoadError;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white text-slate-900 font-sans">
      <ChatSidebar
        chats={history.chats}
        activeChatId={history.activeChatId}
        isLoading={history.isListLoading}
        error={history.listError}
        onSelectChat={handleSelectChat}
        onNewChat={handleNewChat}
        onRefreshChats={history.refresh}
        onOpenDocuments={() => setIsDocumentsOpen(true)}
        onLogout={onLogout}
        userId={userId}
        isOpen={isSidebarOpen}
        onToggleOpen={() => setIsSidebarOpen(!isSidebarOpen)}
        documentCount={documentCount}
      />

      <main className="flex-1 flex flex-col h-full min-w-0 bg-white relative">
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
        />

        <div className="shrink-0 bg-white border-t border-slate-100 pt-3">
          {isViewingHistoryEntry && <HistoryEntryNotice />}
          <ChatComposer
            onSendMessage={handleSend}
            onCancelStream={chat.cancel}
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
  );
}
