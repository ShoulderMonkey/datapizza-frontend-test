import { StreamChunk } from '@/types/chat';

/**
 * Parses a stream of Uint8Array chunks into typed NDJSON StreamChunk items.
 * Robust against arbitrary chunk boundaries, multi-byte UTF-8 sequences,
 * and lines split across network packets.
 */
export async function* parseNDJSONStream(
  stream: ReadableStream<Uint8Array>,
  signal?: AbortSignal
): AsyncGenerator<StreamChunk, void, unknown> {
  const reader = stream.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      if (signal?.aborted) {
        throw new DOMException('Stream aborted by user', 'AbortError');
      }

      const { done, value } = await reader.read();

      if (done) {
        // Flush remaining bytes in decoder
        buffer += decoder.decode(new Uint8Array(), { stream: false });
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      // Split lines by newline (\r\n or \n)
      const lines = buffer.split(/\r?\n/);
      // The last element is either an incomplete line or empty string (if chunk ended with newline)
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          const parsed = JSON.parse(trimmed) as StreamChunk;
          if (parsed && typeof parsed === 'object' && 'type' in parsed) {
            yield parsed;
          } else {
            console.warn('Received non-standard NDJSON line (missing type):', trimmed);
          }
        } catch (parseError) {
          console.warn('Failed to parse NDJSON line as JSON:', trimmed, parseError);
        }
      }
    }

    // Process any remaining non-empty line after the stream closes
    if (buffer.trim()) {
      const trimmed = buffer.trim();
      try {
        const parsed = JSON.parse(trimmed) as StreamChunk;
        if (parsed && typeof parsed === 'object' && 'type' in parsed) {
          yield parsed;
        }
      } catch (parseError) {
        console.warn('Failed to parse trailing NDJSON line as JSON:', trimmed, parseError);
      }
    }
  } finally {
    reader.releaseLock();
  }
}
