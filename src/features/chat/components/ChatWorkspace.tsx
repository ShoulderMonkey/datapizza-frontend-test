'use client';

import React, { useState } from 'react';
import { DocumentListModal } from '@/src/features/documents/components/DocumentListModal';
import { useDocuments } from '@/src/features/documents/hooks/useDocuments';
import { PdfFactCheckViewer } from '@/src/features/factcheck/components/PdfFactCheckViewer';
import { usePdfViewer } from '@/src/features/factcheck/hooks/usePdfViewer';
import { ChatSidebar } from '@/src/features/history/components/ChatSidebar';
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

/**
 * Layout of the authenticated app. It only wires hooks (history, documents, stream,
 * PDF panel) to presentational components: no API calls and no stream logic here.
 */
export function ChatWorkspace({ userId, onLogout }: ChatWorkspaceProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isDocumentsOpen, setIsDocumentsOpen] = useState(false);

  const history = useChatHistory();
  const documents = useDocuments({ enabled: true });
  const pdfViewer = usePdfViewer();
  const chat = useChatStream({ chatId: history.activeChatId, onStreamEnd: history.refresh });
  const { endRef, onScroll } = useAutoScroll(chat.messages);

  const documentCount = documents.hasLoaded ? documents.documents.length : undefined;

  const handleSelectChat = async (chatId: string) => {
    chat.cancel();
    const transcript = await history.openChat(chatId);
    if (transcript) {
      chat.replaceMessages(
        transcript.messages.map((m): ChatMessage => ({ ...m, status: 'completed' }))
      );
    }
  };

  const handleNewChat = () => {
    chat.cancel();
    history.clearActiveChat();
    chat.replaceMessages([]);
  };

  const handleInspectCitation = (citation: CitationReference) => {
    const conversationCitations = chat.messages.flatMap((m) => m.citations ?? []);
    pdfViewer.inspectCitation(citation, conversationCitations);
  };

  const handleSend = (query: string) => {
    void chat.send(query);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white text-slate-900 font-sans">
      <ChatSidebar
        chats={history.chats}
        activeChatId={history.activeChatId}
        isLoading={false}
        error={null}
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
          onRetryLoad={() => history.activeChatId && handleSelectChat(history.activeChatId)}
          onInspectCitation={handleInspectCitation}
          onRetry={chat.retry}
          endRef={endRef}
          onScroll={onScroll}
          emptyState={
            <WelcomePanel onOpenDocuments={() => setIsDocumentsOpen(true)} onAskQuestion={handleSend} />
          }
        />

        <div className="shrink-0 bg-white border-t border-slate-100 pt-3">
          <ChatComposer onSendMessage={handleSend} onCancelStream={chat.cancel} isStreaming={chat.isStreaming} />
        </div>
      </main>

      {pdfViewer.target && (
        <PdfFactCheckViewer
          documentId={pdfViewer.target.documentId}
          filename={pdfViewer.target.filename}
          initialPage={pdfViewer.target.pageNumber}
          citations={pdfViewer.target.allCitations}
          activeCitation={pdfViewer.target.citation}
          onClose={pdfViewer.close}
          onSelectCitation={pdfViewer.selectCitation}
        />
      )}

      <DocumentListModal
        isOpen={isDocumentsOpen}
        onClose={() => {
          setIsDocumentsOpen(false);
          void documents.refresh();
        }}
        onOpenPdfViewer={pdfViewer.openDocument}
      />
    </div>
  );
}
