import { request } from './client';
import { createApiError } from './errors';

/** Items per page requested by the UI (backend accepts limit 1-100, default 20: docs/AUDIT.md §2). */
export const PAGE_SIZE = 20;

export interface FetchPageOptions<T> {
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
  /** Maps/validates one raw item; throw an ApiError (`invalid_response`) when malformed. */
  validate?: (item: unknown) => T;
}

/**
 * GET `endpoint?limit=L&offset=O`: one page of a bare-array list endpoint (no total is returned).
 * A non-array body is an `invalid_response` error.
 */
export async function fetchPage<T = unknown>(
  endpoint: string,
  { limit = PAGE_SIZE, offset = 0, signal, validate }: FetchPageOptions<T> = {},
): Promise<T[]> {
  const data = await request<unknown>(`${endpoint}?limit=${limit}&offset=${offset}`, {
    method: 'GET',
    signal,
  });
  if (!Array.isArray(data)) throw createApiError('invalid_response', { endpoint });
  return data.map((item) => (validate ? validate(item) : (item as T)));
}

/** Offset of the next page, or undefined when the last page was short (= no more items). */
export function nextOffset(lastPage: readonly unknown[], loadedPages: number, limit = PAGE_SIZE): number | undefined {
  return lastPage.length < limit ? undefined : loadedPages * limit;
}
