import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
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

// Real overlay (with the real highlight context) on top of a fake page.
vi.mock('@/src/features/factcheck/components/PdfPageView', async () => {
  const { BoundingBoxOverlay } = await import('@/src/features/factcheck/components/BoundingBoxOverlay');
  return {
    PdfPageView: (p: {
      pageNumber: number;
      citations: CitationReference[];
      activeCitation?: CitationReference | null;
      onSelectCitation?: (c: CitationReference) => void;
    }) => (
      <div data-testid="page-view" style={{ position: 'relative' }}>
        <BoundingBoxOverlay
          pageNumber={p.pageNumber}
          pageWidthPt={612}
          renderedWidthPx={612}
          citations={p.citations}
          activeCitation={p.activeCitation}
          onSelectCitation={p.onSelectCitation}
        />
      </div>
    ),
  };
});

import { ChatWorkspace } from '@/src/features/chat/components/ChatWorkspace';

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

let originalScroll: typeof Element.prototype.scrollIntoView;
let originalMatchMedia: typeof window.matchMedia | undefined;
let scrollMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  originalScroll = Element.prototype.scrollIntoView;
  originalMatchMedia = window.matchMedia;
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: true, media: q, addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false, onchange: null,
  })) as unknown as typeof window.matchMedia;
  scrollMock = vi.fn();
  Element.prototype.scrollIntoView = scrollMock as unknown as typeof Element.prototype.scrollIntoView;
  vi.spyOn(console, 'warn').mockImplementation(() => {});
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
});
afterEach(() => {
  Element.prototype.scrollIntoView = originalScroll;
  window.matchMedia = originalMatchMedia as typeof window.matchMedia;
  vi.restoreAllMocks();
});

async function openViewer() {
  const user = userEvent.setup();
  renderWithProviders(<ChatWorkspace userId="u1" onLogout={() => {}} />);
  await user.type(screen.getByRole('textbox', { name: 'Domanda sui documenti' }), 'domanda{Enter}');
  const cards = await screen.findAllByTestId('citation-card');
  expect(cards).toHaveLength(2);
  await user.click(cards[0]);
  await waitFor(() => expect(screen.getAllByTestId('bbox')).toHaveLength(3));
  return { user, cards };
}

describe('P2-01 bidirectional highlight citation <-> PDF', () => {
  it('click on a PDF box marks its chat card aria-current and scrolls it into view', async () => {
    const { user, cards } = await openViewer();
    expect(cards[0]).toHaveAttribute('aria-current', 'true');
    expect(cards[1]).not.toHaveAttribute('aria-current');
    scrollMock.mockClear();

    const boxes = screen.getAllByTestId('bbox');
    await user.click(boxes[1]); // first box of c2

    await waitFor(() => expect(cards[1]).toHaveAttribute('aria-current', 'true'));
    expect(cards[0]).not.toHaveAttribute('aria-current');
    expect(scrollMock).toHaveBeenCalled();
    expect(scrollMock.mock.contexts).toContain(cards[1]);
    expect(scrollMock.mock.contexts).not.toContain(cards[0]);
    // the box click does not steal focus into the card
    expect(cards[1]).not.toHaveFocus();
  });

  it('hover on a chat card toggles data-highlighted only on the boxes of that citation', async () => {
    const { user, cards } = await openViewer();
    const boxes = screen.getAllByTestId('bbox');
    const flags = () => boxes.map((b) => b.getAttribute('data-highlighted'));
    expect(flags()).toEqual(['false', 'false', 'false']);

    await user.hover(cards[1]);
    expect(flags()).toEqual(['false', 'true', 'true']);
    expect(boxes[1].className).toContain('ring-amber-400/40');
    expect(boxes[0].className).not.toContain('ring-amber-400/40');

    await user.unhover(cards[1]);
    expect(flags()).toEqual(['false', 'false', 'false']);

    await user.hover(cards[0]);
    expect(flags()).toEqual(['true', 'false', 'false']);
  });

  it('keyboard focus/blur on a chat card toggles data-highlighted on its boxes', async () => {
    const { cards } = await openViewer();
    const boxes = screen.getAllByTestId('bbox');
    const flags = () => boxes.map((b) => b.getAttribute('data-highlighted'));

    cards[1].focus();
    await waitFor(() => expect(flags()).toEqual(['false', 'true', 'true']));
    cards[1].blur();
    await waitFor(() => expect(flags()).toEqual(['false', 'false', 'false']));
  });

  it('hover on a viewer panel card also highlights its boxes', async () => {
    const { user } = await openViewer();
    const boxes = screen.getAllByTestId('bbox');
    const viewerCards = screen.getAllByTestId('viewer-citation-card');
    const target = viewerCards.find((c) => within(c).queryByText(/seconda citazione/))!;
    await user.hover(target);
    expect(boxes.map((b) => b.getAttribute('data-highlighted'))).toEqual(['false', 'true', 'true']);
    await user.unhover(target);
    expect(boxes.every((b) => b.getAttribute('data-highlighted') === 'false')).toBe(true);
  });
});
