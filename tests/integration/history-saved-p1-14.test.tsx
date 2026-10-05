import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/src/mocks/server';
import { ndjsonResponse } from '@/src/mocks/ndjson';
import { renderWithProviders } from '@/src/test/render';
import { ChatWorkspace } from '@/src/features/chat/components/ChatWorkspace';

const rec = (id: string, created_at: string, query: string, response: string) => ({
  id, user_id: 'u1', created_at, query, response,
});
const A = rec('A', '2025-01-01T10:00:00Z', 'Titolo A', 'Risposta della voce A');
const SAVED = 'Conversazione salvata nello storico';

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const entries = () => screen.getAllByTestId('history-entry');
const statusEl = () => screen.getByRole('status');

/** Backend double: GET list/A, POST stores a new entry (unless `store` is false) with the sent query. */
function backend(chunks: string[], opts: { store?: boolean } = {}) {
  let list = [A];
  server.use(
    http.get('*/api/chat/', () => HttpResponse.json(list)),
    http.get('*/api/chat/A', () => HttpResponse.json(A)),
    http.post('*/api/chat/', async ({ request }) => {
      const body = (await request.json()) as { query: string };
      if (opts.store !== false) list = [A, rec('N', '2025-06-01T10:00:00Z', body.query, 'Nuova risposta')];
      return ndjsonResponse(chunks);
    })
  );
}

async function send(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.type(screen.getByRole('textbox'), text);
  await user.click(screen.getByRole('button', { name: /invia/i }));
}

describe('saved entry feedback (P1-14, ADR 0007)', () => {
  it('marks the new top entry as active, announces the saving and labels the previous entry context', async () => {
    backend(['{"type":"content","delta":"Nuova risposta"}\n']);
    const user = userEvent.setup();
    renderWithProviders(<ChatWorkspace userId="u1" onLogout={() => {}} />);
    await user.click(await screen.findByRole('button', { name: /Titolo A/ }));
    await screen.findByText('Risposta della voce A');
    await send(user, 'Nuova domanda');

    await waitFor(() => expect(statusEl()).toHaveTextContent(SAVED));
    expect(entries()).toHaveLength(2);
    expect(within(entries()[0]).getByText('Nuova domanda')).toBeInTheDocument();
    expect(entries()[0]).toHaveAttribute('aria-current', 'true');
    expect(entries()[1]).not.toHaveAttribute('aria-current');

    const group = screen.getByRole('group', { name: 'Dalla conversazione precedente' });
    expect(within(group).getByText('Titolo A')).toBeInTheDocument();
    expect(within(group).getByText('Risposta della voce A')).toBeInTheDocument();
    expect(screen.getByText('Dalla conversazione precedente')).toBeVisible();
  });

  it('a repeated question marks the new entry, not the old one with the same query', async () => {
    backend(['{"type":"content","delta":"Nuova risposta"}\n']);
    const user = userEvent.setup();
    renderWithProviders(<ChatWorkspace userId="u1" onLogout={() => {}} />);
    await screen.findByRole('button', { name: /Titolo A/ });
    await send(user, 'Titolo A');

    await waitFor(() => expect(statusEl()).toHaveTextContent(SAVED));
    await waitFor(() => expect(entries()).toHaveLength(2));
    // N (new, created later) is on top; A (older, same query) must not be marked.
    expect(entries()[0]).toHaveAttribute('aria-current', 'true');
    expect(entries()[1]).not.toHaveAttribute('aria-current');
  });

  it('no announcement and no active entry after an error chunk', async () => {
    backend(['{"type":"content","delta":"Parz"}\n', '{"type":"error","message":"boom"}\n']);
    const user = userEvent.setup();
    renderWithProviders(<ChatWorkspace userId="u1" onLogout={() => {}} />);
    await screen.findByRole('button', { name: /Titolo A/ });
    await send(user, 'Domanda con errore');

    await waitFor(() => expect(document.querySelector('[data-status="error"]')).not.toBeNull());
    await waitFor(() => expect(entries()).toHaveLength(2));
    expect(screen.queryByText(SAVED)).not.toBeInTheDocument();
    expect(document.querySelector('[aria-current]')).toBeNull();
  });

  it('no announcement and no active entry after "Interrompi"', async () => {
    let list = [A];
    server.use(
      http.get('*/api/chat/', () => HttpResponse.json(list)),
      http.post('*/api/chat/', ({ request }) => {
        list = [A, rec('N', '2025-06-01T10:00:00Z', 'Domanda interrotta', 'x')];
        const enc = new TextEncoder();
        const body = new ReadableStream<Uint8Array>({
          start(c) {
            c.enqueue(enc.encode('{"type":"content","delta":"Parz"}\n'));
            request.signal.addEventListener('abort', () => {
              try { c.close(); } catch { /* already closed */ }
            });
          },
        });
        return new Response(body, { headers: { 'Content-Type': 'application/x-ndjson' } });
      })
    );
    const user = userEvent.setup();
    renderWithProviders(<ChatWorkspace userId="u1" onLogout={() => {}} />);
    await screen.findByRole('button', { name: /Titolo A/ });
    await send(user, 'Domanda interrotta');
    await screen.findByText(/Parz/);
    await user.click(await screen.findByRole('button', { name: /interrompi/i }));

    await waitFor(() => expect(screen.getByRole('textbox')).toBeEnabled());
    await new Promise((r) => setTimeout(r, 100));
    expect(screen.queryByText(SAVED)).not.toBeInTheDocument();
    expect(document.querySelector('[aria-current]')).toBeNull();
  });

  it('"Nuova conversazione" clears aria-current and the announcement', async () => {
    backend(['{"type":"content","delta":"Nuova risposta"}\n']);
    const user = userEvent.setup();
    renderWithProviders(<ChatWorkspace userId="u1" onLogout={() => {}} />);
    await screen.findByRole('button', { name: /Titolo A/ });
    await send(user, 'Nuova domanda');
    await waitFor(() => expect(statusEl()).toHaveTextContent(SAVED));
    expect(entries()[0]).toHaveAttribute('aria-current', 'true');

    await user.click(screen.getByRole('button', { name: /nuova conversazione/i }));
    await waitFor(() => expect(document.querySelector('[aria-current]')).toBeNull());
    expect(screen.queryByText(SAVED)).not.toBeInTheDocument();
  });
});
