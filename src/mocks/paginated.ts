import { http, HttpResponse } from 'msw';

export interface PageRequest {
  limit: number;
  offset: number;
}

/**
 * Emulates the real backend pagination (docs/AUDIT.md §2): `limit` 1-100 (default 20), `offset` default 0,
 * bare array response in the stored order (created ascending). limit > 100 or < 1 gives 422.
 */
export function paginatedListHandler<T>(path: string, items: T[], requests: PageRequest[] = []) {
  return http.get(path, ({ request }) => {
    const url = new URL(request.url);
    const limit = url.searchParams.has('limit') ? Number(url.searchParams.get('limit')) : 20;
    const offset = url.searchParams.has('offset') ? Number(url.searchParams.get('offset')) : 0;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0) {
      return HttpResponse.json({ detail: [{ loc: ['query'], msg: 'invalid pagination', type: 'value_error' }] }, { status: 422 });
    }
    requests.push({ limit, offset });
    return HttpResponse.json(items.slice(offset, offset + limit));
  });
}
