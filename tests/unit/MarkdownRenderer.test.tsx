import { render, screen, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MarkdownRenderer } from '@/components/chat/MarkdownRenderer';
import { MOCK_RESPONSE_TABLE, MOCK_RESPONSE_UL } from '../fixtures/mockChatResponses';

function assertNoXss(container: HTMLElement) {
  expect(container.querySelectorAll('script').length).toBe(0);
  const withOn = Array.from(container.querySelectorAll('*')).filter((el) =>
    Array.from(el.attributes).some((a) => a.name.toLowerCase().startsWith('on')),
  );
  expect(withOn).toHaveLength(0);
  const bad = Array.from(container.querySelectorAll('[href]')).filter((el) =>
    /^[\s\u0000-\u001f]*javascript:/i.test(el.getAttribute('href') ?? ''),
  );
  expect(bad).toHaveLength(0);
}

describe('MarkdownRenderer', () => {
  it('renders the backend mock HTML table as a real <table> with <strong>', () => {
    render(<MarkdownRenderer content={MOCK_RESPONSE_TABLE} />);
    const tables = screen.getAllByRole('table');
    // GFM table + inline HTML table
    expect(tables.length).toBe(2);
    const htmlTable = tables.find((t) => within(t).queryByText('Approvato'));
    expect(htmlTable).toBeDefined();
    expect(within(htmlTable!).getByText('Approvato').tagName).toBe('STRONG');
    expect(screen.queryByText(/<table>/)).toBeNull();
  });

  it('renders inline <ul><li><strong> as real list elements', () => {
    const { container } = render(
      <MarkdownRenderer content="<ul><li><strong>Area</strong></li></ul>" />,
    );
    const list = screen.getByRole('list');
    expect(list.tagName).toBe('UL');
    expect(within(list).getByText('Area').tagName).toBe('STRONG');
    expect(container.textContent).not.toContain('<ul>');
  });

  it('renders the backend mock HTML list as a real list', () => {
    render(<MarkdownRenderer content={MOCK_RESPONSE_UL} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('Area').tagName).toBe('STRONG');
  });

  it('strips <script> but keeps adjacent text', () => {
    const { container } = render(
      <MarkdownRenderer content={'ciao <script>alert(1)</script> mondo'} />,
    );
    assertNoXss(container);
    expect(container.textContent).toContain('ciao');
    expect(container.textContent).toContain('mondo');
  });

  it('strips onerror handlers from <img>', () => {
    const { container } = render(
      <MarkdownRenderer content={'testo <img src=x onerror=alert(1)> fine'} />,
    );
    assertNoXss(container);
    expect(container.textContent).toContain('testo');
    expect(container.textContent).toContain('fine');
  });

  it.each([
    '<a href="javascript:alert(1)">x</a>',
    '<a href="JaVaScRiPt:alert(1)">x</a>',
    '<a href="  javascript:alert(1)">x</a>',
    '[x](javascript:alert(1))',
  ])('neutralises javascript: link %s', (content) => {
    const { container } = render(<MarkdownRenderer content={content} />);
    assertNoXss(container);
    expect(container.textContent).toContain('x');
  });

  it('renders "> citazione" as a <blockquote> (not escaped &gt;)', () => {
    const { container } = render(<MarkdownRenderer content={'> citazione'} />);
    // No ARIA role for blockquote in testing-library's role map for this version: use querySelector
    const bq = container.querySelector('blockquote');
    expect(bq).not.toBeNull();
    expect(bq!.textContent).toContain('citazione');
    expect(container.textContent).not.toContain('>');
  });

  it('renders "> citazione" as <blockquote> even when the content also has inline HTML', () => {
    // DOMPurify returns plain text untouched, but escapes ">" to "&gt;" as soon as the
    // input contains markup, which breaks the Markdown blockquote syntax.
    const { container } = render(
      <MarkdownRenderer content={'Intro <strong>importante</strong>\n\n> citazione'} />,
    );
    const bq = container.querySelector('blockquote');
    expect(bq).not.toBeNull();
    expect(bq!.textContent).toContain('citazione');
    expect(container.textContent).not.toContain('>');
  });

  it('renders a GFM table as <table>', () => {
    render(<MarkdownRenderer content={'| A | B |\n|---|---|\n| 1 | 2 |'} />);
    const table = screen.getByRole('table');
    expect(within(table).getByText('1')).toBeDefined();
    expect(screen.getAllByRole('columnheader')).toHaveLength(2);
  });
});
