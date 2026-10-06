import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ChatMessageItem } from '@/src/features/chat/components/ChatMessageItem';
import type { ChatMessage } from '@/src/features/chat/types';

const noop = () => {};

function renderMessage(role: ChatMessage['role'], content: string) {
  const message: ChatMessage = { id: 'm1', role, content, status: 'completed' };
  const { container } = render(<ChatMessageItem message={message} onInspectCitation={noop} />);
  const row = container.querySelector(`[data-role="${role}"]`) as HTMLElement;
  expect(row).not.toBeNull();
  return row;
}

/** Deepest element inside the row whose text is exactly the message content. */
function findContentElement(row: HTMLElement, content: string): HTMLElement | null {
  const matches = Array.from(row.querySelectorAll<HTMLElement>('*')).filter(
    (el) => el.textContent === content
  );
  return matches.length ? matches[matches.length - 1] : null;
}

function chain(el: HTMLElement, row: HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (let cur: HTMLElement | null = el; cur && cur !== row; cur = cur.parentElement) out.push(cur);
  return out;
}

describe('User message rendered literally (P1-20)', () => {
  it('does not interpret markdown or HTML in the user bubble', () => {
    const input = '<img src=x onerror=alert(1)> **bold** [l](javascript:alert(1))';
    const row = renderMessage('user', input);

    expect(row.querySelector('img')).toBeNull();
    expect(row.querySelector('strong')).toBeNull();
    expect(row.querySelector('a')).toBeNull();
    expect(findContentElement(row, input)).not.toBeNull();
  });

  it('preserves line breaks and wraps long words in the user bubble', () => {
    const input = 'riga 1\nriga 2';
    const row = renderMessage('user', input);
    const el = findContentElement(row, input);
    expect(el).not.toBeNull();

    const els = chain(el!, row);
    const classes = els.flatMap((e) => Array.from(e.classList));
    const styles = els.map((e) => e.style.whiteSpace);
    const keepsNewlines =
      classes.includes('whitespace-pre-wrap') ||
      classes.includes('whitespace-pre-line') ||
      styles.some((s) => s === 'pre-wrap' || s === 'pre-line');
    const breaksWords = classes.some((c) =>
      ['break-words', 'wrap-break-word', '[overflow-wrap:anywhere]', 'wrap-anywhere'].includes(c)
    );
    expect(keepsNewlines).toBe(true);
    expect(breaksWords).toBe(true);
  });

  it('keeps markdown and sanitization for assistant messages', () => {
    const row = renderMessage(
      'assistant',
      '**bold** <mark>x</mark> <img src=x onerror="alert(1)">'
    );
    expect(row.querySelector('strong')?.textContent).toBe('bold');
    expect(row.querySelector('script')).toBeNull();
    const img = row.querySelector('img');
    if (img) expect(img.hasAttribute('onerror')).toBe(false);
  });
});
