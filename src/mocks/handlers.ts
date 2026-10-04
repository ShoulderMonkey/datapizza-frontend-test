import { http } from 'msw';
import { ndjsonResponse } from './ndjson';

export const handlers = [
  // Example: streaming chat endpoint, line split across two network chunks.
  http.post('http://localhost:8000/chat', () =>
    ndjsonResponse([
      '{"type":"content","delta":"Ci',
      'ao"}\n{"type":"content","delta":"!"}\n',
    ])
  ),
];
