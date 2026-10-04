import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/src/mocks/server';
import { chatService } from '@/services/chat-service';
import { ApiClientError } from '@/services/api-client';
import type { StreamChunk } from '@/types/chat';

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
  ])('HTTP %i raises ApiClientError with statusCode and not a network error', async (status, body) => {
    server.use(http.post('*/api/chat/', () => HttpResponse.json(body, { status })));
    const err = await drain().then(
      () => null,
      (e: unknown) => e
    );
    expect(err).toBeInstanceOf(ApiClientError);
    const apiErr = err as ApiClientError;
    expect(apiErr.statusCode).toBe(status);
    expect(apiErr.isNetworkError).toBe(false);
  });

  it('a network failure is flagged as network error without statusCode', async () => {
    server.use(http.post('*/api/chat/', () => HttpResponse.error()));
    const err = (await drain().then(
      () => null,
      (e: unknown) => e
    )) as ApiClientError;
    expect(err).toBeInstanceOf(ApiClientError);
    expect(err.isNetworkError).toBe(true);
    expect(err.statusCode).toBeUndefined();
  });
});
