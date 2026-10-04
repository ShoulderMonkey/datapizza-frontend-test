/** Builds a ReadableStream<Uint8Array> emitting the given string chunks as-is. */
export function streamFromChunks(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
}

/** NDJSON Response simulating the backend chat stream. */
export function ndjsonResponse(chunks: string[]): Response {
  return new Response(streamFromChunks(chunks), {
    headers: { 'Content-Type': 'application/x-ndjson' },
  });
}
