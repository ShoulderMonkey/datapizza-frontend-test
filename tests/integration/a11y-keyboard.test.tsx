import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, renderHook, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
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
import { WelcomePanel } from '@/src/features/chat/components/WelcomePanel';
import { RelatedDocumentsSection } from '@/src/features/factcheck/components/RelatedDocumentsSection';
import { PdfFactCheckViewer } from '@/src/features/factcheck/components/PdfFactCheckViewer';
import { BoundingBoxOverlay } from '@/src/features/factcheck/components/BoundingBoxOverlay';
import { useSidebarOpen } from '@/src/features/history/hooks/useSidebarOpen';

const citation: CitationReference = {
  document_id: 'd1', filename: 'a.pdf', page_number: 2, text_quote: 'testo citato',
  bounding_regions: [{ page_number: 2, rects_in: [[1, 2, 2, 0.5]] }] as CitationReference['bounding_regions'],
};

describe('no clickable <div> in src (P1-10)', () => {
  function walk(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full, out);
      else if (/\.(tsx|jsx)$/.test(name)) out.push(full);
    }
    return out;
  }
  it('has 0 occurrences of <div ... onClick (also multiline)', () => {
    // Only decorative backdrops (aria-hidden="true", with a keyboard alternative) may carry onClick.
    const offenders = walk(join(process.cwd(), 'src')).filter((f) =>
      [...readFileSync(f, 'utf8').matchAll(/<div\b[^>]*onClick[^>]*/g)].some(
        (m) => !/aria-hidden="true"/.test(m[0])
      )
    );
    expect(offenders).toEqual([]);
  });
});

describe('cards are real buttons', () => {
  it('WelcomePanel suggestion cards are buttons and work', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const onAsk = vi.fn();
    render(<WelcomePanel onOpenDocuments={onOpen} onAskQuestion={onAsk} />);
    const upload = screen.getByRole('button', { name: /Carica PDF/ });
    const ask = screen.getByRole('button', { name: /Fai una domanda/ });
    upload.focus();
    await user.keyboard('{Enter}');
    ask.focus();
    await user.keyboard(' ');
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onAsk).toHaveBeenCalledTimes(1);
  });

  it('RelatedDocumentsSection citation card is a button activated by keyboard', async () => {
    const user = userEvent.setup();
    const onInspect = vi.fn();
    renderWithProviders(<RelatedDocumentsSection citations={[citation]} onInspectCitation={onInspect} />);
    const card = screen.getByRole('button', { name: /Verifica nel PDF/ });
    card.focus();
    await user.keyboard('{Enter}');
    expect(onInspect).toHaveBeenCalledWith(citation);
  });

  it('viewer CITAZIONI list cards are buttons', () => {
    render(
      <PdfFactCheckViewer documentId="d1" filename="a.pdf" citations={[citation]} activeCitation={citation} onClose={() => {}} />
    );
    const card = screen.getByRole('button', { name: /testo citato/ });
    expect(card).toHaveAttribute('aria-current', 'true');
  });
});

describe('live region and focus during the stream', () => {
  const enc = new TextEncoder();
  const line = (d: string) => enc.encode(JSON.stringify({ type: 'content', delta: d }) + '\n');
  let ctrl: ReadableStreamDefaultController<Uint8Array>;

  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    server.use(
      http.post('*/api/chat/', () => {
        const body = new ReadableStream<Uint8Array>({
          start(c) {
            ctrl = c;
            c.enqueue(line('Parz'));
          },
        });
        return new Response(body, { headers: { 'Content-Type': 'application/x-ndjson' } });
      })
    );
  });
  afterEach(() => vi.restoreAllMocks());

  it('log is aria-live polite, busy only while streaming; focus stays on the textarea', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ChatWorkspace userId="u1" onLogout={() => {}} />);
    const box = screen.getByRole('textbox', { name: 'Domanda sui documenti' });
    const log = screen.getByRole('log');
    expect(log).toHaveAttribute('aria-live', 'polite');
    expect(log).toHaveAttribute('aria-busy', 'false');

    await user.type(box, 'domanda{Enter}');
    await screen.findByText(/Parz/);
    expect(log).toHaveAttribute('aria-busy', 'true');
    expect(box).toHaveFocus();

    await act(async () => {
      ctrl.enqueue(new TextEncoder().encode(JSON.stringify({ type: 'done' }) + '\n'));
      ctrl.close();
    });
    await waitFor(() => expect(log).toHaveAttribute('aria-busy', 'false'));
    expect(box).toHaveFocus();
    expect(screen.getByRole('button', { name: /invia/i })).toBeInTheDocument();
  });
});

describe('useSidebarOpen', () => {
  const original = window.matchMedia;
  let listeners: Array<() => void>;
  let matches: boolean;

  beforeEach(() => {
    listeners = [];
    matches = false;
    window.matchMedia = vi.fn().mockImplementation((q: string) => ({
      get matches() { return matches; },
      media: q,
      addEventListener: (_: string, cb: () => void) => listeners.push(cb),
      removeEventListener: (_: string, cb: () => void) => { listeners = listeners.filter((l) => l !== cb); },
    })) as unknown as typeof window.matchMedia;
  });
  afterEach(() => {
    window.matchMedia = original;
  });

  it('is closed under 768px and open from 768px, following viewport changes', () => {
    const { result, unmount } = renderHook(() => useSidebarOpen());
    expect(result.current.isOpen).toBe(false);
    expect(window.matchMedia).toHaveBeenCalledWith('(min-width: 768px)');
    act(() => { matches = true; listeners.forEach((l) => l()); });
    expect(result.current.isOpen).toBe(true);
    unmount();
    expect(listeners).toHaveLength(0);
  });

  it('is open from the start on a wide viewport', () => {
    matches = true;
    const { result } = renderHook(() => useSidebarOpen());
    expect(result.current.isOpen).toBe(true);
  });

  it('server snapshot is closed', async () => {
    const { renderToString } = await import('react-dom/server');
    matches = true; // would be open on the client
    function Probe() {
      return <span>{useSidebarOpen().isOpen ? 'open' : 'closed'}</span>;
    }
    expect(renderToString(<Probe />)).toContain('closed');
  });

  it('the user choice wins over the viewport', () => {
    matches = true;
    const { result } = renderHook(() => useSidebarOpen());
    act(() => result.current.toggle());
    expect(result.current.isOpen).toBe(false);
    act(() => { matches = false; listeners.forEach((l) => l()); });
    expect(result.current.isOpen).toBe(false);
    act(() => result.current.setOpen(true));
    expect(result.current.isOpen).toBe(true);
    act(() => { matches = true; listeners.forEach((l) => l()); });
    expect(result.current.isOpen).toBe(true);
  });
});

describe('documents modal and bboxes keyboard behaviour', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('Escape closes the documents dialog and focus returns to the opener', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ChatWorkspace userId="u1" onLogout={() => {}} />);
    const opener = screen.getAllByRole('button', { name: /documenti pdf|libreria/i })[0];
    opener.focus();
    await user.keyboard('{Enter}');
    const dialog = await screen.findByRole('dialog', { name: 'Libreria Documenti PDF' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(opener).toHaveFocus();
  });

  it('bboxes are out of the tab order (tabIndex=-1)', () => {
    render(
      <BoundingBoxOverlay pageNumber={2} pageWidthPt={612} renderedWidthPx={612} citations={[citation]} activeCitation={citation} />
    );
    const boxes = screen.getAllByTestId('bbox');
    expect(boxes.length).toBeGreaterThan(0);
    boxes.forEach((b) => expect(b).toHaveAttribute('tabindex', '-1'));
  });
});
