import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/src/mocks/server';
import { chatService, documentService, ApiError } from '@/src/api';

async function errorOf(p: Promise<unknown>): Promise<unknown> {
  return p.then(
    () => null,
    (e: unknown) => e
  );
}

describe('POST /api/chat/ request contract', () => {
  it('sends only query/history and Accept application/x-ndjson', async () => {
    let body: Record<string, unknown> = {};
    let accept: string | null = null;
    server.use(
      http.post('*/api/chat/', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        accept = request.headers.get('accept');
        return new Response('{"type":"done"}\n', { headers: { 'content-type': 'application/x-ndjson' } });
      })
    );
    const payload = {
      query: 'ciao',
      history: [{ role: 'user', content: 'a' }],
      chat_id: 'x',
    } as unknown as Parameters<typeof chatService.streamQuery>[0];
    for await (const c of chatService.streamQuery(payload)) void c;
    const keys = Object.keys(body);
    expect(keys).toContain('query');
    for (const k of keys) expect(['query', 'history']).toContain(k);
    expect(accept).toBe('application/x-ndjson');
  });

  it('omits history when empty', async () => {
    let body: Record<string, unknown> = {};
    server.use(
      http.post('*/api/chat/', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return new Response('{"type":"done"}\n', { headers: { 'content-type': 'application/x-ndjson' } });
      })
    );
    for await (const c of chatService.streamQuery({ query: 'ciao', history: [] })) void c;
    expect(Object.keys(body)).toEqual(['query']);
  });
});

describe('invalid_response on malformed bodies', () => {
  it.each([[{ chats: [] }], ['nope'], [null]])('listChats with non-array %j', async (payload) => {
    server.use(http.get('*/api/chat/', () => HttpResponse.json(payload)));
    const err = await errorOf(chatService.listChats());
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe('invalid_response');
  });

  it('getChat with object lacking query/response', async () => {
    server.use(http.get('*/api/chat/:id', () => HttpResponse.json({ id: 'c1', title: 't', messages: [] })));
    const err = await errorOf(chatService.getChat('c1'));
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe('invalid_response');
  });

  it('getChat maps a real ChatRecord to user + assistant messages', async () => {
    server.use(
      http.get('*/api/chat/:id', () =>
        HttpResponse.json({
          id: 'c1',
          user_id: 'u',
          created_at: '2025-01-01T00:00:00Z',
          query: 'Domanda?',
          response: 'Risposta.',
        })
      )
    );
    const t = await chatService.getChat('c1');
    expect(t.messages.map((m) => [m.role, m.content])).toEqual([
      ['user', 'Domanda?'],
      ['assistant', 'Risposta.'],
    ]);
  });
});

describe('documentService.listDocuments', () => {
  it('returns the bare array unchanged', async () => {
    const docs = [
      {
        id: 'd1',
        filename: 'a.pdf',
        content_type: 'application/pdf',
        upload_date: '2025-01-01T00:00:00Z',
        status: 'processed',
        page_count: 3,
        file_hash: 'abc',
      },
    ];
    server.use(http.get('*/api/documents/', () => HttpResponse.json(docs)));
    expect(await documentService.listDocuments()).toEqual(docs);
  });
});
