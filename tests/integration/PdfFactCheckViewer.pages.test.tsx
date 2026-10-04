import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CitationReference } from '@/src/api';

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

import { PdfFactCheckViewer } from '@/src/features/factcheck/components/PdfFactCheckViewer';

const citation: CitationReference = {
  document_id: 'd1', filename: 'a.pdf', page_number: 2, text_quote: 'cit',
  bounding_regions: [
    { page_number: 5, rects_in: [[1, 1, 2, 0.5]] },
    { page_number: 2, rects_in: [[1, 2, 2, 0.5]] },
  ] as CitationReference['bounding_regions'],
};

describe('PdfFactCheckViewer pages with regions', () => {
  it('lists pages with regions, starts at bounding_regions[0].page_number and navigates', async () => {
    const user = userEvent.setup();
    render(
      <PdfFactCheckViewer documentId="d1" filename="a.pdf" citations={[citation]} activeCitation={citation} onClose={() => {}} />
    );
    const nav = screen.getByRole('navigation', { name: 'Pagine con regioni' });
    const p2 = within(nav).getByRole('button', { name: 'Pag. 2' });
    const p5 = within(nav).getByRole('button', { name: 'Pag. 5' });
    expect(p5).toHaveAttribute('aria-current', 'page');
    expect(p2).not.toHaveAttribute('aria-current');
    expect(await screen.findByText('page 5')).toBeInTheDocument();

    await user.click(p2);
    expect(p2).toHaveAttribute('aria-current', 'page');
    expect(p5).not.toHaveAttribute('aria-current');
    expect(await screen.findByText('page 2')).toBeInTheDocument();
  });
});
