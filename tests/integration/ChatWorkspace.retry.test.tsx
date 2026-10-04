import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { server } from '@/src/mocks/server';
import { ndjsonResponse } from '@/src/mocks/ndjson';
import { ChatWorkspace } from '@/src/features/chat/components/ChatWorkspace';

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('ChatWorkspace retry after stop', () => {
  it('keeps a single user bubble and a single assistant answer after stop + retry', async () => {
    let calls = 0;
    server.use(
      http.post('*/api/chat/', ({ request }) => {
        calls += 1;
        if (calls > 1) {
          return ndjsonResponse(['{"type":"content","delta":"Risposta finale"}\n']);
        }
        // First stream: one chunk, then stays open until the client aborts.
        const encoder = new TextEncoder();
        const body = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode('{"type":"content","delta":"Parz"}\n'));
            request.signal.addEventListener('abort', () => {
              try {
                controller.error(new DOMException('aborted', 'AbortError'));
              } catch {
                /* already closed */
              }
            });
          },
        });
        return new Response(body, { headers: { 'Content-Type': 'application/x-ndjson' } });
      })
    );

    const user = userEvent.setup();
    render(<ChatWorkspace userId="u1" onLogout={() => {}} />);
    await user.type(screen.getByRole('textbox'), 'Domanda unica?');
    await user.click(screen.getByRole('button', { name: /invia/i }));

    await user.click(await screen.findByRole('button', { name: /interrompi/i }));
    await user.click(await screen.findByRole('button', { name: /^riprova/i }));

    await screen.findByText(/Risposta finale/);
    await waitFor(() => expect(document.querySelectorAll('[data-role="assistant"]')).toHaveLength(1));
    const userBubbles = document.querySelectorAll('[data-role="user"]');
    expect(userBubbles).toHaveLength(1);
    expect(userBubbles[0].textContent).toContain('Domanda unica?');
  });
});
