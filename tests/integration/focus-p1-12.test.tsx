import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
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
  PdfPageView: ({ pageNumber }: { pageNumber: number }) => <div data-testid="page-view">page {pageNumber}</div>,
}));

import { ChatWorkspace } from '@/src/features/chat/components/ChatWorkspace';
import { PdfFactCheckViewer } from '@/src/features/factcheck/components/PdfFactCheckViewer';

const mk = (page: number, quote: string): CitationReference => ({
  document_id: 'd1', filename: 'a.pdf', page_number: page, text_quote: quote,
  bounding_regions: [{ page_number: page, rects_in: [[1, 2, 2, 0.5]] }] as CitationReference['bounding_regions'],
});

describe('focus after "Interrompi" (P1-12)', () => {
  const enc = new TextEncoder();
  const line = (o: object) => enc.encode(JSON.stringify(o) + '\n');
  let ctrl: ReadableStreamDefaultController<Uint8Array>;

  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    server.use(
      http.post('*/api/chat/', () => {
        const body = new ReadableStream<Uint8Array>({
          start(c) {
            ctrl = c;
            c.enqueue(line({ type: 'content', delta: 'Parz' }));
          },
        });
        return new Response(body, { headers: { 'Content-Type': 'application/x-ndjson' } });
      })
    );
  });
  afterEach(() => vi.restoreAllMocks());

  async function startStream(user: ReturnType<typeof userEvent.setup>) {
    renderWithProviders(<ChatWorkspace userId="u1" onLogout={() => {}} />);
    const box = screen.getByRole('textbox', { name: 'Domanda sui documenti' });
    await user.type(box, 'domanda{Enter}');
    await screen.findByText(/Parz/);
    return { box, stop: await screen.findByRole('button', { name: /interrompi/i }) };
  }

  it('mouse click on Interrompi leaves the focus on the textarea', async () => {
    const user = userEvent.setup();
    const { box, stop } = await startStream(user);
    await user.click(stop);
    await waitFor(() => expect(screen.queryByRole('button', { name: /interrompi/i })).not.toBeInTheDocument());
    expect(document.activeElement).toBe(box);
  });

  it('Enter on the focused Interrompi leaves the focus on the textarea', async () => {
    const user = userEvent.setup();
    const { box, stop } = await startStream(user);
    stop.focus();
    expect(stop).toHaveFocus();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(screen.queryByRole('button', { name: /interrompi/i })).not.toBeInTheDocument());
    expect(document.activeElement).toBe(box);
  });

  it('when the stream ends by itself while Interrompi has focus, the focus goes to the textarea, not <body>', async () => {
    const user = userEvent.setup();
    const { box, stop } = await startStream(user);
    stop.focus();
    expect(stop).toHaveFocus();
    await act(async () => {
      ctrl.enqueue(line({ type: 'done' }));
      ctrl.close();
    });
    await waitFor(() => expect(screen.queryByRole('button', { name: /interrompi/i })).not.toBeInTheDocument());
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toBe(box);
  });
});

describe('viewer skip link "Vai alle citazioni" (P1-12)', () => {
  const cits = [mk(1, 'prima citazione'), mk(2, 'seconda citazione'), mk(3, 'terza citazione')];

  it('is the first tab stop and Tab + Enter (2 key presses) focuses the first citation card', async () => {
    const user = userEvent.setup();
    render(
      <PdfFactCheckViewer documentId="d1" filename="a.pdf" citations={cits} activeCitation={cits[1]} onClose={() => {}} />
    );
    await user.tab();
    const skip = screen.getByRole('button', { name: 'Vai alle citazioni' });
    expect(skip).toHaveFocus();
    await user.keyboard('{Enter}');
    const first = screen.getAllByTestId('viewer-citation-card')[0];
    expect(document.activeElement).toBe(first);
    expect(first).toHaveTextContent('prima citazione');
  });

  it('is not rendered when the citation list is hidden', async () => {
    const user = userEvent.setup();
    render(
      <PdfFactCheckViewer documentId="d1" filename="a.pdf" citations={cits} activeCitation={cits[0]} onClose={() => {}} />
    );
    expect(screen.getByRole('button', { name: 'Vai alle citazioni' })).toBeInTheDocument();
    const toggle = screen.getAllByRole('button').find((b) => /citazion/i.test(b.getAttribute('title') ?? b.getAttribute('aria-label') ?? ''));
    if (toggle) {
      await user.click(toggle);
      expect(screen.queryByRole('button', { name: 'Vai alle citazioni' })).not.toBeInTheDocument();
    }
  });
});
