import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, delay } from 'msw';
import type { CitationReference } from '@/src/api';
import { server } from '@/src/mocks/server';
import { renderWithProviders } from '@/src/test/render';

vi.mock('@/src/features/factcheck/hooks/usePdfDocument', () => ({
  usePdfDocument: () => ({
    file: new Blob(['%PDF'], { type: 'application/pdf' }),
    isLoading: false,
    loadingMessage: '',
    error: null,
    blobUrl: null,
  }),
}));
vi.mock('@/src/features/factcheck/components/PdfPageView', () => ({
  PdfPageView: () => <div data-testid="page-view" />,
}));

import { ChatWorkspace } from '@/src/features/chat/components/ChatWorkspace';
import { ChatComposer } from '@/src/features/chat/components/ChatComposer';
import { DocumentListModal } from '@/src/features/documents/components/DocumentListModal';

const c1: CitationReference = {
  document_id: 'd1', filename: 'a.pdf', page_number: 1, text_quote: 'prima citazione',
  bounding_regions: [{ page_number: 1, rects_in: [[1, 1, 2, 0.5]] }] as CitationReference['bounding_regions'],
};
const c2: CitationReference = {
  document_id: 'd1', filename: 'a.pdf', page_number: 1, text_quote: 'seconda citazione',
  bounding_regions: [{ page_number: 1, rects_in: [[1, 3, 2, 0.5], [1, 4, 2, 0.5]] }] as CitationReference['bounding_regions'],
};
const enc = new TextEncoder();
const ndjson = (o: unknown) => enc.encode(JSON.stringify(o) + '\n');

const doc = (id: string, filename: string) => ({
  id, filename, content_type: 'application/pdf', upload_date: '2025-01-01T00:00:00Z',
  status: 'completed', page_count: 1, file_hash: id,
});

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('P1-15 citations panel: "N box" in Italian', () => {
  it('each viewer citation card shows "N box" (no English plural "boxes")', async () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((q: string) => ({
      matches: true, media: q, addEventListener: () => {}, removeEventListener: () => {},
      addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false, onchange: null,
    })) as unknown as typeof window.matchMedia;
    const originalScroll = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = vi.fn() as unknown as typeof Element.prototype.scrollIntoView;
    try {
      server.use(
        http.post('*/api/chat/', () => {
          const body = new ReadableStream<Uint8Array>({
            start(c) {
              c.enqueue(ndjson({ type: 'content', delta: 'Risposta' }));
              c.enqueue(ndjson({ type: 'citations', references: [c1, c2] }));
              c.enqueue(ndjson({ type: 'done' }));
              c.close();
            },
          });
          return new Response(body, { headers: { 'Content-Type': 'application/x-ndjson' } });
        })
      );
      const user = userEvent.setup();
      renderWithProviders(<ChatWorkspace userId="u1" onLogout={() => {}} />);
      await user.type(screen.getByRole('textbox', { name: 'Domanda sui documenti' }), 'domanda{Enter}');
      const cards = await screen.findAllByTestId('citation-card');
      await user.click(cards[0]);
      const viewerCards = await screen.findAllByTestId('viewer-citation-card');
      const card1 = viewerCards.find((c) => within(c).queryByText(/prima citazione/))!;
      const card2 = viewerCards.find((c) => within(c).queryByText(/seconda citazione/))!;
      expect(within(card1).getByText('1 box')).toBeInTheDocument();
      expect(within(card2).getByText('2 box')).toBeInTheDocument();
      expect(screen.queryByText(/boxes/)).not.toBeInTheDocument();
    } finally {
      Element.prototype.scrollIntoView = originalScroll;
      window.matchMedia = originalMatchMedia;
    }
  });
});

describe('P1-15 document modal', () => {
  function renderModal() {
    return renderWithProviders(<DocumentListModal isOpen onClose={() => {}} onOpenPdfViewer={() => {}} />);
  }

  it('after a successful upload the list tab shows a role=status message with the file name; changing tab clears it', async () => {
    let uploaded = false;
    server.use(
      http.get('*/api/documents/', () => HttpResponse.json(uploaded ? [doc('d1', 'nuovo.pdf')] : [])),
      http.post('*/api/documents/', () => {
        uploaded = true;
        return HttpResponse.json({ message: 'ok' });
      })
    );
    const user = userEvent.setup();
    renderModal();
    await user.click(await screen.findByRole('button', { name: /^Carica/ }));
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, new File(['%PDF-1.4'], 'nuovo.pdf', { type: 'application/pdf' }));
    await user.click(screen.getByRole('button', { name: 'Carica 1 file' }));

    // Back on the list tab: the dropzone is unmounted but the outcome stays visible.
    await screen.findByText(/file disponibili sul backend/);
    const notice = await screen.findByText(/nuovo\.pdf.*caricato con successo/);
    expect(notice.closest('[role="status"]')).not.toBeNull();

    // Changing tab clears it.
    await user.click(screen.getAllByRole('button', { name: /^Carica/ })[0]);
    await user.click(screen.getByRole('button', { name: /^Documenti/ }));
    expect(screen.queryByText(/caricato con successo/)).not.toBeInTheDocument();
  });

  it('while the list loads it shows "Caricamento…" and never "0 file"; then "N file disponibili"', async () => {
    server.use(
      http.get('*/api/documents/', async () => {
        await delay(150);
        return HttpResponse.json([doc('d1', 'a.pdf'), doc('d2', 'b.pdf')]);
      })
    );
    renderModal();
    expect(screen.getByText('Caricamento…')).toBeInTheDocument();
    expect(screen.queryByText(/0 file/)).not.toBeInTheDocument();
    expect(await screen.findByText(/2 file disponibili/)).toBeInTheDocument();
    expect(screen.queryByText('Caricamento…')).not.toBeInTheDocument();
  });
});

describe('P1-15 composer 10000 character limit', () => {
  let posts = 0;
  beforeEach(() => {
    posts = 0;
    server.use(
      http.post('*/api/chat/', () => {
        posts++;
        return new Response('', { headers: { 'Content-Type': 'application/x-ndjson' } });
      })
    );
  });

  function setText(el: HTMLElement, value: string) {
    // user.type of 10k chars is too slow: set via the native setter + input event.
    return import('@testing-library/react').then(({ fireEvent }) => fireEvent.change(el, { target: { value } }));
  }

  it('10001 chars: Invia disabled, Enter sends nothing, query_too_long message linked via aria-describedby, aria-invalid', async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<ChatComposer onSendMessage={onSend} onCancelStream={() => {}} isStreaming={false} />);
    const box = screen.getByRole('textbox', { name: 'Domanda sui documenti' });
    await setText(box, 'a'.repeat(10001));

    expect(screen.getByRole('button', { name: 'Invia messaggio' })).toBeDisabled();
    expect(box).toHaveAttribute('aria-invalid', 'true');
    const msg = screen.getByText(/il limite è di 10000 caratteri/);
    expect(msg).toBeInTheDocument();
    const ids = (box.getAttribute('aria-describedby') ?? '').split(' ');
    expect(ids).toContain(msg.closest('[id]')!.id);

    box.focus();
    await user.keyboard('{Enter}');
    expect(onSend).not.toHaveBeenCalled();
    expect(posts).toBe(0);
  });

  it('10001 chars through the workspace: Enter does not issue POST /api/chat/', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ChatWorkspace userId="u1" onLogout={() => {}} />);
    const box = screen.getByRole('textbox', { name: 'Domanda sui documenti' });
    await setText(box, 'a'.repeat(10001));
    box.focus();
    await user.keyboard('{Enter}');
    await new Promise((r) => setTimeout(r, 50));
    expect(posts).toBe(0);
  });

  it('exactly 10000 chars is allowed and sent; counter is visible above 9000 but not at 9000', async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<ChatComposer onSendMessage={onSend} onCancelStream={() => {}} isStreaming={false} />);
    const box = screen.getByRole('textbox', { name: 'Domanda sui documenti' });

    await setText(box, 'a'.repeat(9000));
    expect(screen.queryByText(/\/10000 caratteri/)).not.toBeInTheDocument();
    await setText(box, 'a'.repeat(9001));
    expect(screen.getByText(/9001\/10000 caratteri/)).toBeInTheDocument();

    await setText(box, 'a'.repeat(10000));
    expect(box).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByText(/il limite è di 10000 caratteri/)).not.toBeInTheDocument();
    const send = screen.getByRole('button', { name: 'Invia messaggio' });
    expect(send).toBeEnabled();
    await user.click(send);
    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));
    expect(onSend.mock.calls[0][0]).toHaveLength(10000);
  });
});
