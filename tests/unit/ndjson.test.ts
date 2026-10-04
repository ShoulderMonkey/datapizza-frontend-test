import { describe, it, expect } from 'vitest';
import { parseNDJSONStream } from '@/src/api';
import { streamFromChunks } from '@/src/mocks/ndjson';

async function collect(stream: ReadableStream<Uint8Array>) {
  const out: unknown[] = [];
  for await (const c of parseNDJSONStream(stream)) out.push(c);
  return out;
}

describe('parseNDJSONStream', () => {
  it('produces a single object for a line split across two chunks', async () => {
    const out = await collect(
      streamFromChunks(['{"type":"content","del', 'ta":"ciao"}\n'])
    );
    expect(out).toEqual([{ type: 'content', delta: 'ciao' }]);
  });
});
