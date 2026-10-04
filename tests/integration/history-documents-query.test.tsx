import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, delay } from 'msw';
import { server } from '@/src/mocks/server';
import { ndjsonResponse } from '@/src/mocks/ndjson';
import { renderWithProviders } from '@/src/test/render';
import { ChatWorkspace } from '@/src/features/chat/components/ChatWorkspace';
import { DocumentListModal } from '@/src/features/documents/components/DocumentListModal';

const chatRec = (id: string, created_at: string, query = `Domanda ${id}`, response = `Risposta ${id}`) => ({
  id, user_id: 'u1', created_at, query, response,
});
const doc = (id: string, filename: string, page_count = 5) => ({
  id, filename, content_type: 'application/pdf', upload_date: '2025-01-01T00:00:00Z',
  status: 'completed', page_count, file_hash: `hash-${id}`,
});

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const renderApp = () => renderWithProviders(<ChatWorkspace userId="u1" onLogout={() => {}} />);

describe('chat list: loading and error states', () => {
  it('shows an accessible loading indicator while GET /api/chat/ is pending', async () => {
    server.use(
      http.get('*/api/chat/', async () => {
        await delay(300);
        return HttpResponse.json([chatRec('1', '2025-01-01T10:00:00Z', 'Prima domanda')]);
      })
    );
    renderApp();
    expect(await screen.findByRole('status')).toHaveTextContent(/caricamento cronologia/i);
    expect(await screen.findByText('Prima domanda')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows an error with "Riprova" that repeats the request and then renders the list', async () => {
    let calls = 0;
    server.use(
      http.get('*/api/chat/', () => {
        calls += 1;
        if (calls === 1) return HttpResponse.json({ detail: 'boom' }, { status: 500 });
        return HttpResponse.json([chatRec('1', '2025-01-01T10:00:00Z', 'Dopo il retry')]);
      })
    );
    const user = userEvent.setup();
    renderApp();
    const retry = await screen.findByRole('button', { name: /^riprova$/i });
    expect(calls).toBe(1);
    await user.click(retry);
    expect(await screen.findByText('Dopo il retry')).toBeInTheDocument();
    expect(calls).toBe(2);
    expect(screen.queryByRole('button', { name: /^riprova$/i })).not.toBeInTheDocument();
  });
});

describe('chat history ordering and selection', () => {
  it('lists chats by created_at descending', async () => {
    server.use(
      http.get('*/api/chat/', () =>
        HttpResponse.json([
          chatRec('a', '2025-01-01T10:00:00Z', 'Vecchia'),
          chatRec('c', '2025-03-01T10:00:00Z', 'Recente'),
          chatRec('b', '2025-02-01T10:00:00Z', 'Media'),
        ])
      )
    );
    renderApp();
    await screen.findByText('Recente');
    const order = ['Recente', 'Media', 'Vecchia'].map((t) => screen.getByText(t));
    for (let i = 0; i < order.length - 1; i++) {
      expect(order[i].compareDocumentPosition(order[i + 1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it('keeps showing chat B when the slower response of chat A arrives after it', async () => {
    let aResolved = false;
    let releaseA!: () => void;
    const aGate = new Promise<void>((r) => (releaseA = r));
    server.use(
      http.get('*/api/chat/', () =>
        HttpResponse.json([chatRec('A', '2025-01-01T10:00:00Z', 'Titolo A', 'Contenuto della chat A'),
          chatRec('B', '2025-02-01T10:00:00Z', 'Titolo B', 'Contenuto della chat B')])
      ),
      http.get('*/api/chat/A', async () => {
        await aGate;
        aResolved = true;
        return HttpResponse.json(chatRec('A', '2025-01-01T10:00:00Z', 'Titolo A', 'Contenuto della chat A'));
      }),
      http.get('*/api/chat/B', () => HttpResponse.json(chatRec('B', '2025-02-01T10:00:00Z', 'Titolo B', 'Contenuto della chat B')))
    );
    const user = userEvent.setup();
    renderApp();
    await user.click(await screen.findByRole('button', { name: /Titolo A/ }));
    await user.click(await screen.findByRole('button', { name: /Titolo B/ }));
    expect(await screen.findByText('Contenuto della chat B')).toBeInTheDocument();

    releaseA();
    await waitFor(() => expect(aResolved).toBe(true));
    await new Promise((r) => setTimeout(r, 50)); // let React Query / effects flush A's response
    expect(screen.getByText('Contenuto della chat B')).toBeInTheDocument();
    expect(screen.queryByText('Contenuto della chat A')).not.toBeInTheDocument();
  });
});

describe('documents', () => {
  it('does not render page_count in the document list', async () => {
    server.use(http.get('*/api/documents/', () => HttpResponse.json([doc('d1', 'bilancio.pdf', 5)])));
    renderWithProviders(<DocumentListModal isOpen onClose={() => {}} onOpenPdfViewer={() => {}} />);
    await screen.findByText('bilancio.pdf');
    expect(screen.queryByText(/pag\./i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\b5\b.*pag/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/pagin/i)).not.toBeInTheDocument();
  });

  it('refetches GET /api/documents/ after a successful upload and updates badge and list', async () => {
    let docs = [doc('d1', 'uno.pdf')];
    let getCalls = 0;
    server.use(
      http.get('*/api/documents/', () => {
        getCalls += 1;
        return HttpResponse.json(docs);
      }),
      http.post('*/api/documents/', () => {
        const added = doc('d2', 'due.pdf');
        docs = [...docs, added];
        return HttpResponse.json({ message: 'ok', documents: [added] });
      })
    );
    const user = userEvent.setup();
    const { container } = renderApp();
    const docsButton = await screen.findByRole('button', { name: /Documenti PDF/ });
    await waitFor(() => expect(within(docsButton).getByText('1')).toBeInTheDocument());
    const before = getCalls;

    await user.click(docsButton);
    await user.click(await screen.findByRole('button', { name: /carica nuovi pdf/i }));
    const input = container.ownerDocument.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, new File(['%PDF-1.4'], 'due.pdf', { type: 'application/pdf' }));
    await user.click(await screen.findByRole('button', { name: /carica 1 file/i }));

    await waitFor(() => expect(getCalls).toBeGreaterThan(before));
    await waitFor(() => expect(within(screen.getByRole('button', { name: /Documenti PDF/ })).getByText('2')).toBeInTheDocument());
    expect(await screen.findByText('due.pdf')).toBeInTheDocument();
  });
});

describe('invalidation at the end of a stream', () => {
  it('refetches GET /api/chat/ when the stream ends', async () => {
    let listCalls = 0;
    server.use(
      http.get('*/api/chat/', () => {
        listCalls += 1;
        return HttpResponse.json(listCalls === 1 ? [] : [chatRec('n', '2025-05-01T10:00:00Z', 'Nuova domanda')]);
      }),
      http.post('*/api/chat/', () => ndjsonResponse(['{"type":"content","delta":"ok"}\n']))
    );
    const user = userEvent.setup();
    renderApp();
    await waitFor(() => expect(listCalls).toBe(1));
    await user.type(screen.getByRole('textbox'), 'Nuova domanda');
    await user.click(screen.getByRole('button', { name: /invia/i }));
    await waitFor(() => expect(listCalls).toBe(2));
    expect(await screen.findAllByText('Nuova domanda')).not.toHaveLength(0);
  });
});
