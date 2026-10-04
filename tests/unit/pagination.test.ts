import { describe, it, expect } from 'vitest';
import { server } from '@/src/mocks/server';
import { paginatedListHandler, type PageRequest } from '@/src/mocks/paginated';
import { chatService, documentService } from '@/src/api';

const pad = (n: number) => String(n).padStart(3, '0');
const makeChats = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `c${pad(i + 1)}`,
    user_id: 'u1',
    created_at: new Date(Date.UTC(2025, 0, 1, 0, i)).toISOString(),
    query: `Domanda ${i + 1}`,
    response: `Risposta ${i + 1}`,
  }));
const makeDocs = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `d${pad(i + 1)}`,
    filename: `doc-${i + 1}.pdf`,
    content_type: 'application/pdf',
    upload_date: '2025-01-01T00:00:00Z',
    status: 'completed',
    page_count: 3,
    file_hash: `hash-${i + 1}`,
  }));

describe('pagination of list endpoints', () => {
  it('chatService.listChats returns all 130 chats using limit=100 pages (offset 0, 100)', async () => {
    const requests: PageRequest[] = [];
    server.use(paginatedListHandler('*/api/chat/', makeChats(130), requests));
    const chats = await chatService.listChats();
    expect(chats).toHaveLength(130);
    expect(chats.map((c) => c.id)).toContain('c130'); // newest, beyond the backend default page
    expect(requests).toEqual([
      { limit: 100, offset: 0 },
      { limit: 100, offset: 100 },
    ]);
  });

  it('documentService.listDocuments returns all 25 documents with a single limit=100 request', async () => {
    const requests: PageRequest[] = [];
    server.use(paginatedListHandler('*/api/documents/', makeDocs(25), requests));
    const docs = await documentService.listDocuments();
    expect(docs).toHaveLength(25);
    expect(requests).toEqual([{ limit: 100, offset: 0 }]);
  });
});
