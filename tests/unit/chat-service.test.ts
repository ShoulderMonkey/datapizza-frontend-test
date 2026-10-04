import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/src/mocks/server';
import { chatService, ApiError, type StreamChunk } from '@/src/api';

async function drain(): Promise<StreamChunk[]> {
  const out: StreamChunk[] = [];
  for await (const c of chatService.streamQuery({ query: 'ciao' })) out.push(c);
  return out;
}

describe('chatService.streamQuery HTTP errors before the stream', () => {
  it.each([
    [400, { detail: 'bad request' }],
    [401, { detail: 'not authenticated' }],
    [500, { detail: 'boom' }],
  ])('HTTP %i raises ApiError with status and not a network error', async (status, body) => {
    server.use(http.post('*/api/chat/', () => HttpResponse.json(body, { status })));
    const err = await drain().then(
      () => null,
      (e: unknown) => e
    );
    expect(err).toBeInstanceOf(ApiError);
    const apiErr = err as ApiError;
    expect(apiErr.status).toBe(status);
    expect(apiErr.code).not.toBe('network');
  });

  it('a network failure is flagged as network error without status', async () => {
    server.use(http.post('*/api/chat/', () => HttpResponse.error()));
    const err = (await drain().then(
      () => null,
      (e: unknown) => e
    )) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('network');
    expect(err.status).toBeNull();
  });
});
