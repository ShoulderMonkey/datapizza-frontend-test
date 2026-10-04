import { http, HttpResponse } from 'msw';
import { ndjsonResponse } from './ndjson';

/** Pydantic 422 body for /api/auth/login (docs/AUDIT.md §2). */
export function loginValidationErrorBody(input: string) {
  return {
    detail: [
      {
        type: 'value_error',
        loc: ['body', 'user_id'],
        msg: 'Value error, user_id must be alphanumeric with - and _ only',
        input,
      },
    ],
  };
}

export const handlers = [
  // Example: streaming chat endpoint, line split across two network chunks.
  http.post('http://localhost:8000/chat', () =>
    ndjsonResponse([
      '{"type":"content","delta":"Ci',
      'ao"}\n{"type":"content","delta":"!"}\n',
    ])
  ),
  // History and documents list called on ChatWorkspace mount (wildcard host: absolute or relative URLs).
  http.get('*/api/chat/', () => HttpResponse.json([])),
  http.get('*/api/documents/', () => HttpResponse.json([])),
  // Login: wildcard prefix matches both absolute (http://localhost:8000) and relative (/api) URLs.
  http.post('*/api/auth/login', async ({ request }) => {
    const body = (await request.json()) as { user_id?: string };
    return HttpResponse.json({ message: 'ok', user_id: body.user_id });
  }),
];
