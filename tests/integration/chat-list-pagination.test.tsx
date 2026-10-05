import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/src/mocks/server';
import { paginatedListHandler, type PageRequest } from '@/src/mocks/paginated';
import { renderWithProviders } from '@/src/test/render';
import { ChatWorkspace } from '@/src/features/chat/components/ChatWorkspace';

const makeChats = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `c${i + 1}`,
    user_id: 'u1',
    created_at: new Date(Date.UTC(2025, 0, 1, 0, i)).toISOString(),
    query: `Domanda numero ${i + 1}`,
    response: `Risposta ${i + 1}`,
  }));
const makeDocs = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `d${i + 1}`,
    filename: `documento-${i + 1}.pdf`,
    content_type: 'application/pdf',
    upload_date: '2025-01-01T00:00:00Z',
    status: 'completed',
    page_count: 3,
    file_hash: `hash-${i + 1}`,
  }));

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const renderApp = () => renderWithProviders(<ChatWorkspace userId="u1" onLogout={() => {}} />);
const entries = () => screen.getAllByTestId('history-entry');

describe('sidebar with a paginated backend (literal pagination)', () => {
  it('shows 20 of 25 chats and "Carica altre" requests offset=20; then all 25, newest first, button gone', async () => {
    const requests: PageRequest[] = [];
    server.use(
      paginatedListHandler('*/api/chat/', makeChats(25), requests),
      paginatedListHandler('*/api/documents/', [], []),
    );
    const user = userEvent.setup();
    renderApp();

    await screen.findByText('Domanda numero 20');
    expect(entries()).toHaveLength(20);
    // Only the loaded entries are sorted: the newest of the first page is on top, chat 25 is not there yet.
    expect(entries()[0]).toHaveTextContent('Domanda numero 20');
    expect(screen.queryByText('Domanda numero 25')).not.toBeInTheDocument();
    expect(requests).toEqual([{ limit: 20, offset: 0 }]);

    await user.click(screen.getByRole('button', { name: 'Carica altre' }));
    await screen.findByText('Domanda numero 25');
    expect(requests).toEqual([
      { limit: 20, offset: 0 },
      { limit: 20, offset: 20 },
    ]);
    expect(entries()).toHaveLength(25);
    expect(entries()[0]).toHaveTextContent('Domanda numero 25'); // newest on top after loading it
    expect(entries()[24]).toHaveTextContent('Domanda numero 1');
    expect(screen.queryByRole('button', { name: /carica altre/i })).not.toBeInTheDocument();
  });

  it('shows no "Carica altre" with fewer than 20 chats', async () => {
    server.use(paginatedListHandler('*/api/chat/', makeChats(5)), paginatedListHandler('*/api/documents/', []));
    renderApp();
    await screen.findByText('Domanda numero 5');
    expect(screen.queryByRole('button', { name: /carica altre/i })).not.toBeInTheDocument();
  });

  it('next-page error: role=alert message, already loaded entries intact, button still available to retry', async () => {
    const all = makeChats(25);
    server.use(
      http.get('*/api/chat/', ({ request }) => {
        const offset = Number(new URL(request.url).searchParams.get('offset'));
        if (offset >= 20) return HttpResponse.json({ detail: 'boom' }, { status: 500 });
        return HttpResponse.json(all.slice(0, 20));
      }),
      paginatedListHandler('*/api/documents/', []),
    );
    const user = userEvent.setup();
    renderApp();
    await screen.findByText('Domanda numero 20');
    await user.click(screen.getByRole('button', { name: 'Carica altre' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/\S/);
    expect(entries()).toHaveLength(20);
    expect(screen.getByText('Domanda numero 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Carica altre' })).toBeEnabled();
  });
});

describe('documents library with a paginated backend (literal pagination)', () => {
  const openModal = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getAllByRole('button', { name: /libreria pdf/i })[0]);
    return screen.findByRole('dialog');
  };

  it('badge shows "20+" when more documents exist', async () => {
    server.use(paginatedListHandler('*/api/chat/', []), paginatedListHandler('*/api/documents/', makeDocs(25)));
    renderApp();
    await waitFor(() => expect(screen.getAllByText('20+').length).toBeGreaterThan(0));
  });

  it('modal shows 20 of 25 documents; "Carica altri" requests offset=20; then 25 and no button', async () => {
    const requests: PageRequest[] = [];
    server.use(paginatedListHandler('*/api/chat/', []), paginatedListHandler('*/api/documents/', makeDocs(25), requests));
    const user = userEvent.setup();
    renderApp();
    const dialog = await openModal(user);

    await within(dialog).findByText('documento-20.pdf');
    expect(within(dialog).getAllByRole('button', { name: /visualizza pdf/i })).toHaveLength(20);
    expect(within(dialog).queryByText('documento-25.pdf')).not.toBeInTheDocument();
    expect(requests.every((r) => r.limit === 20 && r.offset === 0)).toBe(true);

    await user.click(within(dialog).getByRole('button', { name: 'Carica altri' }));
    await within(dialog).findByText('documento-25.pdf');
    expect(requests.at(-1)).toEqual({ limit: 20, offset: 20 });
    expect(within(dialog).getAllByRole('button', { name: /visualizza pdf/i })).toHaveLength(25);
    expect(within(dialog).queryByRole('button', { name: /carica altri/i })).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/20\+/)).not.toBeInTheDocument();
  });

  it('next-page error: role=alert inside the modal, the 20 loaded documents stay', async () => {
    const all = makeDocs(25);
    server.use(
      paginatedListHandler('*/api/chat/', []),
      http.get('*/api/documents/', ({ request }) => {
        const offset = Number(new URL(request.url).searchParams.get('offset'));
        if (offset >= 20) return HttpResponse.json({ detail: 'boom' }, { status: 500 });
        return HttpResponse.json(all.slice(0, 20));
      }),
    );
    const user = userEvent.setup();
    renderApp();
    const dialog = await openModal(user);
    await within(dialog).findByText('documento-20.pdf');
    await user.click(within(dialog).getByRole('button', { name: 'Carica altri' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/\S/);
    expect(within(dialog).getAllByRole('button', { name: /visualizza pdf/i })).toHaveLength(20);
  });
});
