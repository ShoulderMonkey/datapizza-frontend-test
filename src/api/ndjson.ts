import type { StreamChunk } from './types';
import { ERROR_MESSAGES } from './errorMessages';

/** Thrown when a line of the stream is not valid JSON or has no string `type`. */
export class NDJSONParseError extends Error {
  constructor(public readonly line: string, public readonly cause?: unknown) {
    super(ERROR_MESSAGES.stream_malformed);
    this.name = 'NDJSONParseError';
  }
}

const KNOWN_TYPES = new Set(['content', 'citations', 'error']);

/** Parses one line; returns null for unknown chunk types (ignored). */
function parseLine(line: string): StreamChunk | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch (e) {
    throw new NDJSONParseError(line, e);
  }
  if (!parsed || typeof parsed !== 'object' || typeof (parsed as { type?: unknown }).type !== 'string') {
    throw new NDJSONParseError(line);
  }
  const type = (parsed as { type: string }).type;
  if (!KNOWN_TYPES.has(type)) {
    if (process.env.NODE_ENV !== 'production') {
      console.debug('Ignoring unknown NDJSON chunk type:', type);
    }
    return null;
  }
  return parsed as StreamChunk;
}

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

        const chunk = parseLine(trimmed);
        if (chunk) yield chunk;
      }
    }

    // Process any remaining non-empty line after the stream closes
    if (buffer.trim()) {
      const chunk = parseLine(buffer.trim());
      if (chunk) yield chunk;
    }
  } finally {
    // Stop consuming the body if we exit early (error, abort, consumer break).
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
