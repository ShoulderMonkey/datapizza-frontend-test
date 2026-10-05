import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { CitationReference } from '@/src/api';
import { server } from '@/src/mocks/server';
import { renderWithProviders, createTestQueryClient } from '@/src/test/render';
import { installIntersectionObserver } from '@/src/test/intersectionObserver';

// react-pdf cannot run in jsdom: the mocked page reports a known width (600 pt) and "renders".
vi.mock('react-pdf', async () => {
  const React = await import('react');
  return {
    pdfjs: { GlobalWorkerOptions: {} },
    Document: ({ children }: { children: React.ReactNode }) => <div data-testid="pdf-document">{children}</div>,
    Page: ({ pageNumber, onLoadSuccess, onRenderSuccess }: {
      pageNumber: number;
      onLoadSuccess?: (p: { originalWidth: number }) => void;
      onRenderSuccess?: () => void;
    }) => {
      React.useEffect(() => {
        onLoadSuccess?.({ originalWidth: 600 });
        onRenderSuccess?.();
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      return <div data-testid="pdf-page">page {pageNumber}</div>;
    },
  };
});
vi.mock('@/src/features/factcheck/lib/pdfWorker', () => ({}));

import { RelatedDocumentsSection } from '@/src/features/factcheck/components/RelatedDocumentsSection';
import { useDocumentFile } from '@/src/features/factcheck/hooks/useDocumentFile';

const cited: CitationReference = {
  document_id: 'doc-a',
  filename: 'a.pdf',
  page_number: 3,
  text_quote: 'prima',
  bounding_regions: [
    { page_number: 3, rects_in: [[1, 1, 2, 0.5], [3, 2, 1, 1]] },
    { page_number: 7, rects_in: [[1, 1, 1, 1]] }, // other page: must NOT be drawn
  ] as CitationReference['bounding_regions'],
};
const sameDoc: CitationReference = { ...cited, page_number: 4, text_quote: 'seconda', bounding_regions: [{ page_number: 4, rects_in: [[0, 0, 1, 1]] }] as CitationReference['bounding_regions'] };

let fileGets: string[];
let io: ReturnType<typeof installIntersectionObserver>;

function serveFiles(status = 200) {
  server.use(
    http.get('*/api/documents/:id/file', ({ params }) => {
      fileGets.push(String(params.id));
      if (status !== 200) return HttpResponse.json({ detail: 'x' }, { status });
      return new HttpResponse(new Blob(['%PDF-1.4'], { type: 'application/pdf' }), { headers: { 'Content-Type': 'application/pdf' } });
    })
  );
}

beforeEach(() => {
  fileGets = [];
  io = installIntersectionObserver();
});
afterEach(() => io.restore());

const thumbs = () => screen.getAllByTestId('citation-thumbnail');

describe('CitationThumbnail (lazy, shared cache)', () => {
  it('makes no GET before the intersection; afterwards 1 GET, state rendered and only rects of the cited page, scaled to 140px', async () => {
    serveFiles();
    renderWithProviders(<RelatedDocumentsSection citations={[cited]} onInspectCitation={() => {}} />);
    const [thumb] = thumbs();
    expect(thumb).toHaveAttribute('data-state', 'idle');
    await new Promise((r) => setTimeout(r, 50));
    expect(fileGets).toEqual([]);
    expect(thumb).toHaveAttribute('data-state', 'idle');

    io.intersect(thumb);
    await waitFor(() => expect(thumb).toHaveAttribute('data-state', 'rendered'));
    expect(fileGets).toEqual(['doc-a']);
    const rects = within(thumb).getAllByTestId('thumbnail-rect');
    expect(rects).toHaveLength(2); // page 3 only, not the page 7 region
    // factor = 72 * 140 / 600 = 16.8 px per inch
    expect(parseFloat(rects[0].style.left)).toBeCloseTo(16.8);
    expect(parseFloat(rects[0].style.width)).toBeCloseTo(33.6);
    expect(parseFloat(rects[1].style.top)).toBeCloseTo(33.6);
  });

  it('two cards of the same document trigger a single download', async () => {
    serveFiles();
    renderWithProviders(<RelatedDocumentsSection citations={[cited, sameDoc]} onInspectCitation={() => {}} />);
    io.intersect();
    await waitFor(() => thumbs().forEach((t) => expect(t).toHaveAttribute('data-state', 'rendered')));
    expect(fileGets).toEqual(['doc-a']);
  });

  it('a document already cached by a thumbnail is not downloaded again by the viewer hook', async () => {
    serveFiles();
    const client = createTestQueryClient();
    client.setDefaultOptions({ queries: { retry: false, gcTime: Infinity } });
    function Viewer() {
      const q = useDocumentFile('doc-a');
      return <p>{q.data ? 'viewer-ready' : 'viewer-loading'}</p>;
    }
    const user = userEvent.setup();
    function Both() {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <RelatedDocumentsSection citations={[cited]} onInspectCitation={() => setOpen(true)} />
          {open && <Viewer />}
        </>
      );
    }
    renderWithProviders(<Both />, client);
    io.intersect();
    await waitFor(() => expect(thumbs()[0]).toHaveAttribute('data-state', 'rendered'));
    await user.click(screen.getByRole('button', { name: /Verifica nel PDF/ }));
    expect(await screen.findByText('viewer-ready')).toBeInTheDocument();
    expect(fileGets).toEqual(['doc-a']);
  });

  it('a failed download leaves the thumbnail in state error without breaking the card', async () => {
    serveFiles(404);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderWithProviders(<RelatedDocumentsSection citations={[cited]} onInspectCitation={() => {}} />);
    io.intersect();
    await waitFor(() => expect(thumbs()[0]).toHaveAttribute('data-state', 'error'));
    expect(screen.queryAllByTestId('thumbnail-rect')).toHaveLength(0);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Verifica nel PDF/ })).toBeInTheDocument();
  });
});
