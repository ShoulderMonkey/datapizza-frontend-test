import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/src/mocks/server';
import { renderWithProviders } from '@/src/test/render';
import { ChatWorkspace } from '@/src/features/chat/components/ChatWorkspace';

const enc = new TextEncoder();
const line = (d: string) => enc.encode(JSON.stringify({ type: 'content', delta: d }) + '\n');

interface Open {
  signal: AbortSignal;
  push: (d: string) => void;
}
let posts = 0;
let opened: Open[] = [];

/** POST /api/chat/ that stays open: the test pushes chunks and the abort is observable. */
function openStream(first = 'Parz') {
  server.use(
    http.post('*/api/chat/', ({ request }) => {
      posts += 1;
      let ctrl!: ReadableStreamDefaultController<Uint8Array>;
      const body = new ReadableStream<Uint8Array>({
        start(c) {
          ctrl = c;
          c.enqueue(line(first));
        },
      });
      opened.push({
        signal: request.signal,
        push: (d) => {
          try {
            ctrl.enqueue(line(d));
          } catch {
            /* stream already closed by the abort */
          }
        },
      });
      return new Response(body, { headers: { 'Content-Type': 'application/x-ndjson' } });
    })
  );
}

let errorSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  posts = 0;
  opened = [];
  Element.prototype.scrollIntoView = vi.fn();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

async function start(query = 'domanda') {
  const user = userEvent.setup();
  const view = renderWithProviders(<ChatWorkspace userId="u1" onLogout={() => {}} />);
  await user.type(screen.getByRole('textbox'), query);
  await user.click(screen.getByRole('button', { name: /invia/i }));
  await screen.findByText(/Parz/);
  return { user, view };
}

const assistant = () => document.querySelector('[data-role="assistant"]');
const sleep = (ms: number) => act(() => new Promise<void>((r) => setTimeout(r, ms)));

describe('chat stream abort (P1-03)', () => {
  it('Stop keeps the partial text as aborted and a late chunk is not applied; no console.error', async () => {
    openStream();
    const { user } = await start();
    await user.click(screen.getByRole('button', { name: /interrompi/i }));

    await waitFor(() => expect(assistant()?.getAttribute('data-status')).toBe('aborted'));
    expect(opened[0].signal.aborted).toBe(true);
    opened[0].push(' TARDIVO');
    await sleep(80);
    expect(assistant()!.textContent).toContain('Parz');
    expect(assistant()!.textContent).not.toContain('TARDIVO');
    expect(assistant()?.getAttribute('data-status')).toBe('aborted');
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('unmount during the stream aborts the request without warnings', async () => {
    openStream();
    const { view } = await start();
    view.unmount();
    expect(opened[0].signal.aborted).toBe(true);
    opened[0].push(' TARDIVO');
    await sleep(80);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('new chat during the stream aborts the request and the text does not grow', async () => {
    openStream();
    const { user } = await start();
    await user.click(screen.getByRole('button', { name: /nuova conversazione/i }));
    expect(opened[0].signal.aborted).toBe(true);
    opened[0].push(' TARDIVO');
    await sleep(80);
    expect(document.body.textContent).not.toContain('TARDIVO');
    expect(document.body.textContent).not.toContain('Parz');
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('selecting another chat during the stream aborts the request', async () => {
    server.use(
      http.get('*/api/chat/', () =>
        HttpResponse.json([{ id: 'A', user_id: 'u1', created_at: '2025-01-01T10:00:00Z', query: 'Titolo A', response: 'Risposta A' }])
      ),
      http.get('*/api/chat/A', () =>
        HttpResponse.json({ id: 'A', user_id: 'u1', created_at: '2025-01-01T10:00:00Z', query: 'Titolo A', response: 'Risposta A' })
      )
    );
    openStream();
    const { user } = await start();
    await user.click(await screen.findByRole('button', { name: /Titolo A/ }));
    await waitFor(() => expect(opened[0].signal.aborted).toBe(true));
    opened[0].push(' TARDIVO');
    await sleep(80);
    expect(document.body.textContent).not.toContain('TARDIVO');
    expect(errorSpy).not.toHaveBeenCalled();
  });
});

describe('send disabled during a stream (ADR 0003)', () => {
  it('disables the textarea, shows Interrompi instead of Invia, hides Riprova, and Enter does not send twice', async () => {
    openStream();
    const { user } = await start();

    expect(screen.getByRole('textbox')).toBeDisabled();
    expect(screen.queryByRole('button', { name: /invia/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /interrompi/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /riprova/i })).not.toBeInTheDocument();

    await user.type(screen.getByRole('textbox'), 'altra{Enter}');
    await sleep(50);
    expect(posts).toBe(1);
  });
});
