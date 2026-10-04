import { request } from './client';
import { createApiError } from './errors';

/** Backend max page size for list endpoints (docs/AUDIT.md §2: limit 1-100, above that 422). */
export const PAGE_SIZE = 100;
/** Safety cap against an anomalous backend that never returns a short page. */
export const MAX_PAGES = 50;

export interface FetchAllPagesOptions<T> {
  signal?: AbortSignal;
  /** Maps/validates one raw item; throw an ApiError (`invalid_response`) when malformed. */
  validate?: (item: unknown) => T;
}

/**
 * GET `endpoint?limit=100&offset=N` for N = 0, 100, 200... and concatenates the bare arrays,
 * stopping at the first page shorter than PAGE_SIZE. A non-array page is an `invalid_response` error.
 */
export async function fetchAllPages<T = unknown>(
  endpoint: string,
  { signal, validate }: FetchAllPagesOptions<T> = {},
): Promise<T[]> {
  const all: T[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const data = await request<unknown>(`${endpoint}?limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`, {
      method: 'GET',
      signal,
    });
    if (!Array.isArray(data)) throw createApiError('invalid_response', { endpoint });
    for (const item of data) all.push(validate ? validate(item) : (item as T));
    if (data.length < PAGE_SIZE) break;
  }
  return all;
}
