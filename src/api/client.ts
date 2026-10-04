import { ERROR_MESSAGES } from './errorMessages';
import { notifyUnauthorized } from './session';
import { apiErrorFromHttp, createApiError, toApiError } from './errors';

/**
 * Typed HTTP client: the only place in the app that calls `fetch`
 * (enforced by `no-restricted-globals` in eslint.config.mjs).
 *
 * All backend calls go through the same-origin proxy (`rewrites` in next.config.ts,
 * docs/adr/0001-proxy-same-origin.md), so URLs are always relative and start with `/api/`
 * and the `user_id` cookie is first-party (`credentials: 'same-origin'`).
 *
 * Every failure is thrown as an `ApiError` (src/api/errors.ts).
 */

export type RequestOptions = Omit<RequestInit, 'credentials'>;

export function toApiUrl(endpoint: string): string {
  return endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
}

async function readBody(response: Response): Promise<unknown> {
  try {
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  } catch {
    return null;
  }
}

/**
 * Sends the request and returns the 2xx Response.
 * Throws ApiError: `network` if fetch rejects, `aborted` on abort, HTTP codes for non-2xx.
 */
async function send(endpoint: string, options: RequestOptions, defaultAccept: string): Promise<Response> {
  const init = options;
  const headers = new Headers(init.headers ?? {});
  if (!headers.has('Accept')) headers.set('Accept', defaultAccept);

  let response: Response;
  try {
    response = await fetch(toApiUrl(endpoint), {
      ...init,
      headers,
      credentials: 'same-origin',
    });
  } catch (err: unknown) {
    throw toApiError(err, { fallbackCode: 'network', endpoint });
  }

  if (!response.ok) {
    const body = await readBody(response);
    // The login endpoint never answers 401; any other 401 means the cookie session is gone.
    if (response.status === 401 && toApiUrl(endpoint).split('?')[0] !== '/api/auth/login') {
      notifyUnauthorized();
    }
    throw apiErrorFromHttp({ status: response.status, body, endpoint });
  }
  return response;
}

/** JSON request. Non-JSON 2xx bodies are returned as text. */
export async function request<T = unknown>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const response = await send(endpoint, options, 'application/json, text/plain, */*');
  const contentType = response.headers.get('content-type') ?? '';
  try {
    if (contentType.includes('application/json')) {
      return (await response.json()) as T;
    }
    return (await response.text()) as unknown as T;
  } catch (err: unknown) {
    if (err instanceof SyntaxError) {
      throw createApiError('invalid_response', { cause: err, endpoint });
    }
    throw toApiError(err, { fallbackCode: 'network', endpoint });
  }
}

/**
 * Request whose body is consumed by the caller (NDJSON stream, binary download).
 * Returns the 2xx Response; HTTP errors are thrown before the body is read.
 */
export async function requestRaw(endpoint: string, options: RequestOptions = {}): Promise<Response> {
  return send(endpoint, options, '*/*');
}

/** Same as `requestRaw`, but guarantees a readable body (throws `invalid_response` otherwise). */
export async function requestStream(
  endpoint: string,
  options: RequestOptions = {}
): Promise<ReadableStream<Uint8Array>> {
  const response = await requestRaw(endpoint, options);
  if (!response.body) {
    throw createApiError('invalid_response', { endpoint, userMessage: ERROR_MESSAGES.stream_no_body });
  }
  return response.body;
}
