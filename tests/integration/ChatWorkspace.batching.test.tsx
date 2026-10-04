import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { server } from '@/src/mocks/server';
import { ndjsonResponse } from '@/src/mocks/ndjson';
import { renderWithProviders } from '@/src/test/render';
import { ChatWorkspace } from '@/src/features/chat/components/ChatWorkspace';

const renders = vi.hoisted(() => ({ assistant: 0, query: 'DOMANDA-UTENTE' }));

// Counts renders of the message body, ignoring the user message (content === query).
vi.mock('@/src/components/ui/MarkdownRenderer', () => ({
  MarkdownRenderer: ({ content }: { content: string }) => {
    if (content !== renders.query) renders.assistant += 1;
    return <div>{content}</div>;
  },
}));

beforeEach(() => {
  renders.assistant = 0;
  Element.prototype.scrollIntoView = vi.fn();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('chat stream batching (P1-03)', () => {
  it('500 content chunks delivered at once cause at most 5 renders of the assistant message and keep the full text', async () => {
    const chunks = Array.from({ length: 500 }, (_, i) => JSON.stringify({ type: 'content', delta: `w${i} ` }) + '\n');
    const expected = chunks.map((_, i) => `w${i} `).join('');
    server.use(http.post('*/api/chat/', () => ndjsonResponse(chunks)));

    const user = userEvent.setup();
    renderWithProviders(<ChatWorkspace userId="u1" onLogout={() => {}} />);
    await user.type(screen.getByRole('textbox'), renders.query);
    await user.click(screen.getByRole('button', { name: /invia/i }));

    await waitFor(() => expect(document.querySelector('[data-role="assistant"][data-status="completed"]')).not.toBeNull());
    expect(document.querySelector('[data-role="assistant"]')!.textContent).toContain(expected.trim());
    console.info(`[batching] case A renders=${renders.assistant}`);
    expect(renders.assistant).toBeGreaterThan(0);
    expect(renders.assistant).toBeLessThanOrEqual(5);
  });

  /** POST /api/chat/ emitting each chunk in a separate macrotask. */
  function mockSlowStream(n: number) {
    const enc = new TextEncoder();
    server.use(
      http.post('*/api/chat/', () => {
        const body = new ReadableStream<Uint8Array>({
          async start(c) {
            for (let i = 0; i < n; i++) {
              c.enqueue(enc.encode(JSON.stringify({ type: 'content', delta: `w${i} ` }) + '\n'));
              await new Promise((r) => setTimeout(r, 0));
            }
            c.close();
          },
        });
        return new Response(body, { headers: { 'Content-Type': 'application/x-ndjson' } });
      })
    );
  }

  async function runSlow(n: number) {
    mockSlowStream(n);
    const user = userEvent.setup();
    renderWithProviders(<ChatWorkspace userId="u1" onLogout={() => {}} />);
    await user.type(screen.getByRole('textbox'), renders.query);
    await user.click(screen.getByRole('button', { name: /invia/i }));
    await waitFor(
      () => expect(document.querySelector('[data-role="assistant"][data-status="completed"]')).not.toBeNull(),
      { timeout: 4000 }
    );
    const expected = Array.from({ length: n }, (_, i) => `w${i} `).join('').trim();
    expect(document.querySelector('[data-role="assistant"]')!.textContent).toContain(expected);
  }

  it('B: 60 chunks on separate macrotasks stay within 10 assistant renders with real rAF', async () => {
    await runSlow(60);
    console.info(`[batching] case B renders=${renders.assistant}`);
    expect(renders.assistant).toBeGreaterThan(0);
    expect(renders.assistant).toBeLessThanOrEqual(10);
  });

  it('negative control: flushing on every task (batching disabled) renders far more than 30 times', async () => {
    // Flush right after the chunk's task instead of once per frame: no coalescing.
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      queueMicrotask(() => cb(performance.now()));
      return 0;
    });
    await runSlow(60);
    console.info(`[batching] negative control renders=${renders.assistant}`);
    expect(renders.assistant).toBeGreaterThan(30);
  });
});
