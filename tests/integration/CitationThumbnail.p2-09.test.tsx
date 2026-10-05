import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { pdfjs } from 'react-pdf';
import type { CitationReference } from '@/src/api';
import { server } from '@/src/mocks/server';
import { renderWithProviders, createTestQueryClient } from '@/src/test/render';
import { installIntersectionObserver } from '@/src/test/intersectionObserver';
import { queryKeys } from '@/src/features/queryKeys';

const page = vi.hoisted(() => ({ width: 800, height: 600 }));

vi.mock('react-pdf', async () => {
  const React = await import('react');
  const getDocument = vi.fn(() => ({
    promise: Promise.resolve({
      loadingTask: { destroy: vi.fn().mockResolvedValue(undefined) },
      getPage: async () => ({ getViewport: () => ({ width: page.width, height: page.height }) }),
    }),
  }));
  return {
    pdfjs: { GlobalWorkerOptions: {}, getDocument },
    // Like the real component, a <Document file> parses its own copy of the PDF on mount.
    Document: ({ children }: { children: React.ReactNode }) => {
      React.useEffect(() => {
        getDocument();
      }, []);
      return <div>{children}</div>;
    },
    Page: ({ onRenderSuccess, onLoadSuccess }: {
      onRenderSuccess?: () => void;
      onLoadSuccess?: (p: { originalWidth: number }) => void;
    }) => {
      React.useEffect(() => {
        onLoadSuccess?.({ originalWidth: page.width });
        onRenderSuccess?.();
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      return <div data-testid="pdf-page" />;
    },
  };
});
vi.mock('@/src/features/factcheck/lib/pdfWorker', () => ({}));

import { RelatedDocumentsSection } from '@/src/features/factcheck/components/RelatedDocumentsSection';
import { useDocumentUpload } from '@/src/features/documents/hooks/useDocumentUpload';

const cite = (document_id: string, page_number: number, rects: number[][] = [[1, 1, 2, 1]]): CitationReference => ({
  document_id,
  filename: `${document_id}.pdf`,
  page_number,
  text_quote: `q${document_id}${page_number}`,
  bounding_regions: [{ page_number, rects_in: rects }] as CitationReference['bounding_regions'],
});

let fileGets: string[];
let io: ReturnType<typeof installIntersectionObserver>;
const getDocument = pdfjs.getDocument as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  fileGets = [];
  getDocument.mockClear();
  page.width = 800;
  page.height = 600;
  io = installIntersectionObserver();
  server.use(
    http.get('*/api/documents/:id/file', ({ params }) => {
      fileGets.push(String(params.id));
      return new HttpResponse(new Blob(['%PDF-1.4'], { type: 'application/pdf' }), {
        headers: { 'Content-Type': 'application/pdf' },
      });
    })
  );
});
afterEach(() => io.restore());

const thumbs = () => screen.getAllByTestId('citation-thumbnail');

describe('thumbnails P2-09', () => {
  it('a landscape page is shown whole: outer box stays 140x180, page 140x105 centred, rects at the same scale', async () => {
    renderWithProviders(<RelatedDocumentsSection citations={[cite('doc-a', 1)]} onInspectCitation={() => {}} />);
    const [thumb] = thumbs();
    expect(thumb.style.width).toBe('140px');
    expect(thumb.style.height).toBe('180px');
    io.intersect(thumb);
    await waitFor(() => expect(thumb).toHaveAttribute('data-state', 'rendered'));
    // No layout shift: same fixed box before and after.
    expect(thumb.style.width).toBe('140px');
    expect(thumb.style.height).toBe('180px');
    const pageEl = within(thumb).getByTestId('thumbnail-page');
    expect(parseFloat(pageEl.style.width)).toBeCloseTo(140);
    expect(parseFloat(pageEl.style.height)).toBeCloseTo(105);
    expect(pageEl.className).toMatch(/left-1\/2/);
    expect(pageEl.className).toMatch(/top-1\/2/);
    // scale = 140/800 = 0.175 -> 72 * 0.175 = 12.6 px/in
    const [rect] = within(thumb).getAllByTestId('thumbnail-rect');
    expect(parseFloat(rect.style.left)).toBeCloseTo(12.6);
    expect(parseFloat(rect.style.top)).toBeCloseTo(12.6);
    expect(parseFloat(rect.style.width)).toBeCloseTo(25.2);
    expect(parseFloat(rect.style.height)).toBeCloseTo(12.6);
  });

  it('3 cards of the same document parse once; 2 documents parse twice', async () => {
    const same = [cite('doc-a', 1), cite('doc-a', 2), cite('doc-a', 3)];
    const { unmount } = renderWithProviders(<RelatedDocumentsSection citations={same} onInspectCitation={() => {}} />);
    io.intersect();
    await waitFor(() => thumbs().forEach((t) => expect(t).toHaveAttribute('data-state', 'rendered')));
    expect(getDocument).toHaveBeenCalledTimes(1);
    unmount();
    getDocument.mockClear();

    const two = [cite('doc-a', 1), cite('doc-a', 2), cite('doc-b', 1)];
    renderWithProviders(<RelatedDocumentsSection citations={two} onInspectCitation={() => {}} />);
    io.intersect();
    await waitFor(() => thumbs().forEach((t) => expect(t).toHaveAttribute('data-state', 'rendered')));
    expect(getDocument).toHaveBeenCalledTimes(2);
  });

  it('a successful upload invalidates only documents.list(): no new file GET and no new parse for cached documents', async () => {
    server.use(
      http.post('*/api/documents/', () => HttpResponse.json([{ id: 'doc-new', filename: 'n.pdf' }]))
    );
    const client = createTestQueryClient();
    client.setDefaultOptions({ queries: { retry: false, gcTime: Infinity } });
    let upload: ReturnType<typeof useDocumentUpload>['upload'];
    function Uploader() {
      upload = useDocumentUpload().upload;
      return null;
    }
    renderWithProviders(
      <>
        <RelatedDocumentsSection citations={[cite('doc-a', 1)]} onInspectCitation={() => {}} />
        <Uploader />
      </>,
      client
    );
    io.intersect();
    await waitFor(() => expect(thumbs()[0]).toHaveAttribute('data-state', 'rendered'));
    expect(fileGets).toEqual(['doc-a']);
    expect(getDocument).toHaveBeenCalledTimes(1);

    const spy = vi.spyOn(client, 'invalidateQueries');
    const ok = await upload!([new File(['%PDF'], 'n.pdf', { type: 'application/pdf' })]);
    expect(ok).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.documents.list() });
    await new Promise((r) => setTimeout(r, 50));
    expect(fileGets).toEqual(['doc-a']);
    expect(getDocument).toHaveBeenCalledTimes(1);
    expect(client.getQueryState(queryKeys.documents.file('doc-a'))?.isInvalidated).toBe(false);
    expect(client.getQueryState(queryKeys.documents.proxy('doc-a'))?.isInvalidated).toBe(false);
  });
});
