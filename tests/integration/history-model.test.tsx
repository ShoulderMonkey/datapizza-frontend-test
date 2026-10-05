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
const B = rec('B', '2025-02-01T10:00:00Z', 'Titolo B', 'Risposta della voce B');

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const entries = () => screen.getAllByTestId('history-entry');

describe('history model (ADR 0004): a new question never modifies the selected entry', () => {
  it('clears the selection, sends A in history, adds a new entry on top and leaves A unchanged', async () => {
    let list = [A];
    let postBody: { query: string; history?: { role: string; content: string }[] } | undefined;
    server.use(
      http.get('*/api/chat/', () => HttpResponse.json(list)),
      http.get('*/api/chat/A', () => HttpResponse.json(A)),
      http.post('*/api/chat/', async ({ request }) => {
        postBody = (await request.json()) as typeof postBody;
        list = [A, rec('N', '2025-06-01T10:00:00Z', 'Nuova domanda', 'Nuova risposta')];
        return ndjsonResponse(['{"type":"content","delta":"Nuova risposta"}\n']);
      })
    );
    const user = userEvent.setup();
    renderWithProviders(<ChatWorkspace userId="u1" onLogout={() => {}} />);

    await user.click(await screen.findByRole('button', { name: /Titolo A/ }));
    expect(await screen.findByText('Risposta della voce A')).toBeInTheDocument();
    expect(entries()[0]).toHaveAttribute('aria-current', 'true');
    expect(screen.getByTestId('history-entry-notice')).toBeInTheDocument();

    await user.type(screen.getByRole('textbox'), 'Nuova domanda');
    await user.click(screen.getByRole('button', { name: /invia/i }));

    await waitFor(() => expect(entries()).toHaveLength(2));
    // ADR 0007: A is no longer selected; the entry just saved (N, on top) is the active one.
    await waitFor(() => expect(entries()[0]).toHaveAttribute('aria-current', 'true'));
    expect(entries()[1]).not.toHaveAttribute('aria-current');
    expect(document.querySelectorAll('[aria-current]')).toHaveLength(1);
    expect(screen.queryByTestId('history-entry-notice')).not.toBeInTheDocument();

    expect(postBody?.history).toEqual([
      { role: 'user', content: 'Titolo A' },
      { role: 'assistant', content: 'Risposta della voce A' },
    ]);
    expect(within(entries()[0]).getByText('Nuova domanda')).toBeInTheDocument();
    expect(within(entries()[1]).getByText('Titolo A')).toBeInTheDocument();
  });

  it('does not send the history of A when selecting B fails to load', async () => {
    let postBody: { history?: unknown[] } | undefined;
    server.use(
      http.get('*/api/chat/', () => HttpResponse.json([A, B])),
      http.get('*/api/chat/A', () => HttpResponse.json(A)),
      http.get('*/api/chat/B', () => HttpResponse.json({ detail: 'boom' }, { status: 500 })),
      http.post('*/api/chat/', async ({ request }) => {
        postBody = (await request.json()) as typeof postBody;
        return ndjsonResponse(['{"type":"content","delta":"ok"}\n']);
      })
    );
    const user = userEvent.setup();
    renderWithProviders(<ChatWorkspace userId="u1" onLogout={() => {}} />);

    await user.click(await screen.findByRole('button', { name: /Titolo A/ }));
    expect(await screen.findByText('Risposta della voce A')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Titolo B/ }));
    await waitFor(() => expect(screen.queryByText('Risposta della voce A')).not.toBeInTheDocument());
    await screen.findByText('Errore di caricamento');

    const box = screen.getByRole('textbox');
    await waitFor(() => expect(box).toBeEnabled());
    await user.type(box, 'Domanda dopo errore');
    await user.click(screen.getByRole('button', { name: /invia/i }));
    await waitFor(() => expect(postBody).toBeDefined());

    const sent = JSON.stringify(postBody);
    expect(sent).not.toContain('Risposta della voce A');
    expect(sent).not.toContain('Titolo A');
    expect(postBody?.history ?? []).toHaveLength(0);
  });
});
