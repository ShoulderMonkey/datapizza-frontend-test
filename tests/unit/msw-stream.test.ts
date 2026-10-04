import { describe, it, expect } from 'vitest';
import { parseNDJSONStream } from '@/src/api';

describe('MSW NDJSON stream handler', () => {
  it('serves a ReadableStream parsed into two content chunks', async () => {
    const res = await fetch('http://localhost:8000/chat', { method: 'POST' });
    const out: unknown[] = [];
    for await (const c of parseNDJSONStream(res.body!)) out.push(c);
    expect(out).toEqual([
      { type: 'content', delta: 'Ciao' },
      { type: 'content', delta: '!' },
    ]);
  });
});
