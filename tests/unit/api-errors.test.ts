import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/src/mocks/server';
import { loginValidationErrorBody } from '@/src/mocks/handlers';
import {
  ApiError,
  NDJSONParseError,
  USER_ID_INVALID_MESSAGE,
  apiErrorFromHttp,
  extractDetail,
  isAbortError,
  request,
  statusToCode,
  toApiError,
} from '@/src/api';

async function catchError(fn: () => Promise<unknown>): Promise<unknown> {
  return fn().then(
    () => null,
    (e: unknown) => e
  );
}

describe('statusToCode', () => {
  it.each([
    [400, 'bad_request'],
    [401, 'unauthorized'],
    [403, 'forbidden'],
    [404, 'not_found'],
    [422, 'validation'],
    [500, 'server'],
    [503, 'server'],
    [409, 'http'],
  ])('maps %i to %s', (status, code) => {
    expect(statusToCode(status)).toBe(code);
  });
});

describe('extractDetail', () => {
  it('returns a string detail as is', () => {
    expect(extractDetail({ detail: 'Query must not be empty.' })).toBe('Query must not be empty.');
  });
  it('joins msg of a FastAPI detail[] array', () => {
    expect(
      extractDetail({ detail: [{ msg: 'a' }, { msg: 'b' }] })
    ).toBe('a, b');
  });
  it('returns null for empty or non-object bodies', () => {
    expect(extractDetail(null)).toBeNull();
    expect(extractDetail({})).toBeNull();
    expect(extractDetail('')).toBeNull();
  });
});

describe('apiErrorFromHttp', () => {
  it('keeps status, code, parsed body as cause and an Italian userMessage', () => {
    const body = { detail: 'Query must not be empty.' };
    const err = apiErrorFromHttp({ status: 400, body });
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(400);
    expect(err.code).toBe('bad_request');
    expect(err.detail).toBe('Query must not be empty.');
    expect(err.cause).toBe(body);
    expect(err.userMessage).toMatch(/richiesta/i);
  });
  it('uses a status-specific message for unmapped codes and honours overrides', () => {
    expect(apiErrorFromHttp({ status: 418, body: null }).userMessage).toContain('418');
    expect(apiErrorFromHttp({ status: 401, body: null, messages: { unauthorized: 'custom' } }).userMessage).toBe('custom');
  });
});

describe('toApiError', () => {
  it('returns an existing ApiError unchanged', () => {
    const e = apiErrorFromHttp({ status: 500, body: null });
    expect(toApiError(e)).toBe(e);
  });
  it('maps AbortError to aborted with null status', () => {
    const e = toApiError(new DOMException('x', 'AbortError'), { fallbackCode: 'network' });
    expect(e.code).toBe('aborted');
    expect(e.status).toBeNull();
    expect(e.isAborted).toBe(true);
  });
  it('maps NDJSONParseError to stream_parse', () => {
    const e = toApiError(new NDJSONParseError('{bad', new Error('x')), { fallbackCode: 'network' });
    expect(e.code).toBe('stream_parse');
    expect(e.status).toBeNull();
  });
  it('uses the fallback code for other errors, keeping the cause', () => {
    const cause = new TypeError('Failed to fetch');
    const e = toApiError(cause, { fallbackCode: 'network' });
    expect(e.code).toBe('network');
    expect(e.cause).toBe(cause);
    expect(toApiError('boom').code).toBe('unknown');
  });
});

describe('request() error normalization', () => {
  it('network failure -> ApiError network, status null', async () => {
    server.use(http.post('*/api/chat/', () => HttpResponse.error()));
    const err = (await catchError(() => request('/api/chat/', { method: 'POST' }))) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('network');
    expect(err.status).toBeNull();
    expect(err.userMessage).toMatch(/backend/i);
  });

  it('4xx with string detail -> bad_request keeping detail and body as cause', async () => {
    const body = { detail: 'Query must not be empty.' };
    server.use(http.post('*/api/chat/', () => HttpResponse.json(body, { status: 400 })));
    const err = (await catchError(() => request('/api/chat/', { method: 'POST' }))) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(400);
    expect(err.code).toBe('bad_request');
    expect(err.detail).toBe('Query must not be empty.');
    expect(err.cause).toEqual(body);
  });

  it('422 with detail[] -> validation, msg extracted, override message used', async () => {
    const body = loginValidationErrorBody('bad id!');
    server.use(http.post('*/api/chat/', () => HttpResponse.json(body, { status: 422 })));
    const err = (await catchError(() =>
      request('/api/chat/', { method: 'POST', errorMessages: { validation: USER_ID_INVALID_MESSAGE } })
    )) as ApiError;
    expect(err.status).toBe(422);
    expect(err.code).toBe('validation');
    expect(err.detail).toBe(body.detail[0].msg);
    expect(err.userMessage).toBe(USER_ID_INVALID_MESSAGE);
  });

  it('already aborted signal -> aborted, status null, isAbortError true', async () => {
    const controller = new AbortController();
    controller.abort();
    const err = await catchError(() => request('/api/chat/', { method: 'POST', signal: controller.signal }));
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe('aborted');
    expect((err as ApiError).status).toBeNull();
    expect(isAbortError(err)).toBe(true);
  });

  it('abort during a delayed response -> aborted, not network', async () => {
    server.use(
      http.post('*/api/chat/', async () => {
        await new Promise((r) => setTimeout(r, 500));
        return HttpResponse.json({});
      })
    );
    const controller = new AbortController();
    const pending = catchError(() => request('/api/chat/', { method: 'POST', signal: controller.signal }));
    setTimeout(() => controller.abort(), 20);
    const err = await pending;
    expect((err as ApiError).code).toBe('aborted');
    expect(isAbortError(err)).toBe(true);
  });
});
