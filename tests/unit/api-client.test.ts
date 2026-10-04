import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { authService } from '@/src/api';
import { documentService } from '@/src/api';
import { chatService } from '@/src/api';

type FetchArgs = [input: RequestInfo | URL, init?: RequestInit];

let fetchSpy: ReturnType<typeof vi.spyOn>;

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    if (/\/api\/chat\/[^/?]+$/.test(url)) {
      // GET /api/chat/{id}: real ChatRecord shape (docs/AUDIT.md section 2)
      return jsonResponse({
        id: 'c1',
        user_id: 'test_user',
        created_at: '2025-01-01T00:00:00Z',
        query: 'ciao',
        response: 'salve',
      });
    }
    if (url === '/api/chat/' && method === 'POST') {
      return new Response('{"type":"done"}\n', {
        status: 200,
        headers: { 'content-type': 'application/x-ndjson' },
      });
    }
    // GET /api/chat/ and GET /api/documents/: bare arrays
    return jsonResponse([]);
  });
});

afterEach(() => {
  fetchSpy.mockRestore();
});

function expectAllSameOriginApi() {
  expect(fetchSpy).toHaveBeenCalled();
  for (const call of fetchSpy.mock.calls as FetchArgs[]) {
    const [input, init] = call;
    const raw = String(input);
    expect(raw.startsWith('/api/'), `URL "${raw}" must be relative and start with /api/`).toBe(true);
    const parsed = new URL(raw, location.origin);
    expect(parsed.origin).toBe(location.origin);
    expect(parsed.pathname.startsWith('/api/')).toBe(true);
    expect(init?.credentials).not.toBe('include');
  }
}

describe('API client uses the same-origin /api proxy', () => {
  it('authService.login', async () => {
    await authService.login('test_user');
    expectAllSameOriginApi();
    expect(String((fetchSpy.mock.calls[0] as FetchArgs)[0])).toBe('/api/auth/login');
  });

  it('documentService.listDocuments', async () => {
    await documentService.listDocuments();
    expectAllSameOriginApi();
    expect(String((fetchSpy.mock.calls[0] as FetchArgs)[0])).toBe('/api/documents/?limit=100&offset=0');
  });

  it('documentService.uploadDocuments', async () => {
    const file = new File(['%PDF-1.4'], 'a.pdf', { type: 'application/pdf' });
    await documentService.uploadDocuments([file]);
    expectAllSameOriginApi();
  });

  it('documentService.getDocumentFile and getDocumentFileUrl', async () => {
    await documentService.getDocumentFile('doc 1');
    expectAllSameOriginApi();
    const url = documentService.getDocumentFileUrl('doc 1');
    expect(url).toBe('/api/documents/doc%201/file');
  });

  it('chatService.listChats', async () => {
    const chats = await chatService.listChats();
    expectAllSameOriginApi();
    expect(chats).toEqual([]);
    const [url, init] = fetchSpy.mock.calls[0] as FetchArgs;
    expect(String(url)).toBe('/api/chat/?limit=100&offset=0');
    expect(init?.method).toBe('GET');
    expect(fetchSpy).toHaveBeenCalledTimes(1); // empty page: stop after one request
  });

  it('chatService.getChat', async () => {
    const transcript = await chatService.getChat('c1');
    expectAllSameOriginApi();
    const [url, init] = fetchSpy.mock.calls[0] as FetchArgs;
    expect(String(url)).toBe('/api/chat/c1');
    expect(init?.method).toBe('GET');
    expect(transcript.messages.map((m) => m.role)).toEqual(['user', 'assistant']);
  });

  it('chatService.streamQuery', async () => {
    for await (const chunk of chatService.streamQuery({ query: 'ciao' })) void chunk;
    expectAllSameOriginApi();
  });
});
