import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders as render } from '@/src/test/render';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import type { CitationReference } from '@/src/api';

vi.mock('@/src/features/factcheck/components/PdfFactCheckViewer', () => ({
  PdfFactCheckViewer: ({ onClose }: { onClose: () => void }) => (
    <div>
      <button type="button" onClick={onClose}>Chiudi visualizzatore</button>
      <button type="button">Seconda azione</button>
    </div>
  ),
}));

import { FactCheckPanel } from '@/src/features/factcheck/components/FactCheckPanel';
import { RelatedDocumentsSection } from '@/src/features/factcheck/components/RelatedDocumentsSection';

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
      onchange: null,
    }),
  });
}

const c1: CitationReference = { document_id: 'd1', filename: 'a.pdf', page_number: 1, text_quote: 'prima citazione' };
const c2: CitationReference = { document_id: 'd1', filename: 'a.pdf', page_number: 2, text_quote: 'seconda citazione' };

function Harness() {
  const [active, setActive] = useState<CitationReference | null>(null);
  return (
    <>
      <RelatedDocumentsSection citations={[c1, c2]} activeCitation={active} onInspectCitation={setActive} />
      {active && (
        <FactCheckPanel
          target={{ documentId: 'd1', filename: 'a.pdf', pageNumber: active.page_number, citation: active, allCitations: [c1, c2] }}
          onClose={() => setActive(null)}
          onSelectCitation={setActive}
        />
      )}
    </>
  );
}

const cards = () => screen.getAllByRole('button', { name: /Verifica nel PDF/ });

describe('FactCheckPanel', () => {
  afterEach(() => {
    // @ts-expect-error restore jsdom default (no matchMedia)
    delete window.matchMedia;
  });

  describe('desktop (>= 1024px)', () => {
    beforeEach(() => mockMatchMedia(true));

    it('is a non-modal complementary region, focused on open; Escape closes and returns focus to the card', async () => {
      const user = userEvent.setup();
      render(<Harness />);
      const card = cards()[0];
      card.focus();
      await user.keyboard('{Enter}');

      const panel = screen.getByRole('complementary', { name: 'Verifica fonti' });
      expect(panel).not.toHaveAttribute('aria-modal');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(panel).toHaveFocus();

      await user.keyboard('{Escape}');
      expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
      expect(cards()[0]).toHaveFocus();
    });

    it('does not trap Tab: focus can leave the panel', async () => {
      const user = userEvent.setup();
      render(<Harness />);
      await user.click(cards()[0]);
      const panel = screen.getByRole('complementary');
      await user.tab();
      await user.tab();
      await user.tab();
      expect(panel.contains(document.activeElement)).toBe(false);
    });
  });

  describe('mobile (< 1024px)', () => {
    beforeEach(() => mockMatchMedia(false));

    it('is a modal dialog; the close button closes it', async () => {
      const user = userEvent.setup();
      render(<Harness />);
      await user.click(cards()[1]);
      const dialog = screen.getByRole('dialog', { name: 'Verifica fonti' });
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Chiudi visualizzatore' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('Escape closes and focus returns to the card that opened it', async () => {
      const user = userEvent.setup();
      render(<Harness />);
      cards()[1].focus();
      await user.keyboard('{Enter}');
      expect(screen.getByRole('dialog')).toHaveFocus();
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(cards()[1]).toHaveFocus();
    });

    it('traps Tab and Shift+Tab inside the dialog', async () => {
      const user = userEvent.setup();
      render(<Harness />);
      await user.click(cards()[0]);
      const dialog = screen.getByRole('dialog');
      const close = screen.getByRole('button', { name: 'Chiudi visualizzatore' });
      const second = screen.getByRole('button', { name: 'Seconda azione' });

      await user.tab();
      expect(close).toHaveFocus();
      await user.tab();
      expect(second).toHaveFocus();
      await user.tab(); // wraps from last to first
      expect(close).toHaveFocus();
      await user.tab({ shift: true }); // wraps from first to last
      expect(second).toHaveFocus();
      expect(dialog.contains(document.activeElement)).toBe(true);
    });
  });
});

describe('active citation highlighting in the list', () => {
  beforeEach(() => mockMatchMedia(true));
  afterEach(() => {
    // @ts-expect-error restore jsdom default
    delete window.matchMedia;
  });

  it('marks only the active card with aria-current and follows the selection', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(cards()[0]).not.toHaveAttribute('aria-current');
    expect(cards()[1]).not.toHaveAttribute('aria-current');

    await user.click(cards()[0]);
    expect(cards()[0]).toHaveAttribute('aria-current', 'true');
    expect(cards()[1]).not.toHaveAttribute('aria-current');

    await user.click(cards()[1]);
    expect(cards()[1]).toHaveAttribute('aria-current', 'true');
    expect(cards()[0]).not.toHaveAttribute('aria-current');
  });
});
