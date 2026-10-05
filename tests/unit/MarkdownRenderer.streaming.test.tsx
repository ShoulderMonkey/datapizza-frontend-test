import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MarkdownRenderer } from '@/src/components/ui/MarkdownRenderer';
import { MOCK_RESPONSE_TABLE, MOCK_RESPONSE_UL } from '../fixtures/mockChatResponses';

// The backend streams the answer one character at a time, so the renderer receives
// every prefix of the response. A prefix ending inside a tag (`<tab`, `</td`, `<str`)
// must never leak tag fragments as visible text.
const TAG_FRAGMENT = /<[a-zA-Z/!]/;

function checkAllPrefixes(full: string) {
  const { container, rerender } = render(<MarkdownRenderer content="" />);
  for (let i = 1; i <= full.length; i++) {
    const prefix = full.slice(0, i);
    rerender(<MarkdownRenderer content={prefix} />);
    const text = container.textContent ?? '';
    const tail = JSON.stringify(prefix.slice(-25));
    expect(text, `prefix ${i} ending ${tail} shows a literal tag fragment`).not.toMatch(TAG_FRAGMENT);
    expect(text, `prefix ${i} ending ${tail} shows &lt;`).not.toContain('&lt;');
  }
}

describe('MarkdownRenderer while streaming char by char', () => {
  it('never shows literal HTML for the <table> response', () => {
    checkAllPrefixes(MOCK_RESPONSE_TABLE);
  });

  it('never shows literal HTML for the <ul> response', () => {
    checkAllPrefixes(MOCK_RESPONSE_UL);
  });
});
