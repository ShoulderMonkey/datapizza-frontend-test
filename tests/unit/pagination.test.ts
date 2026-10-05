import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/src/mocks/server';
import { paginatedListHandler, type PageRequest } from '@/src/mocks/paginated';
import { chatService, documentService } from '@/src/api';
import { fetchPage, nextOffset, PAGE_SIZE } from '@/src/api/pagination';

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

describe('literal pagination of list endpoints', () => {
  it('chatService.listChats() requests only the first page: limit=20, offset=0', async () => {
    const requests: PageRequest[] = [];
    server.use(paginatedListHandler('*/api/chat/', makeChats(130), requests));
    const chats = await chatService.listChats();
    expect(chats).toHaveLength(20);
    expect(requests).toEqual([{ limit: 20, offset: 0 }]);
  });

  it('chatService.listChats(20) requests the second page with offset=20', async () => {
    const requests: PageRequest[] = [];
    server.use(paginatedListHandler('*/api/chat/', makeChats(130), requests));
    const chats = await chatService.listChats(20);
    expect(chats.map((c) => c.id)[0]).toBe('c021');
    expect(requests).toEqual([{ limit: 20, offset: 20 }]);
  });

  it('documentService.listDocuments returns one page of 20 out of 25, with a single request', async () => {
    const requests: PageRequest[] = [];
    server.use(paginatedListHandler('*/api/documents/', makeDocs(25), requests));
    const docs = await documentService.listDocuments();
    expect(docs).toHaveLength(20);
    expect(requests).toEqual([{ limit: 20, offset: 0 }]);
  });

  it('nextOffset: a full page gives loadedPages * limit, a short or empty page gives undefined', () => {
    expect(PAGE_SIZE).toBe(20);
    expect(nextOffset(new Array(20).fill(0), 1)).toBe(20);
    expect(nextOffset(new Array(20).fill(0), 2)).toBe(40);
    expect(nextOffset(new Array(19).fill(0), 1)).toBeUndefined();
    expect(nextOffset([], 3)).toBeUndefined();
  });

  it('fetchPage rejects a non-array body with invalid_response', async () => {
    server.use(http.get('*/api/chat/', () => HttpResponse.json({ items: [] })));
    await expect(fetchPage('/api/chat/')).rejects.toMatchObject({ code: 'invalid_response' });
  });
});
