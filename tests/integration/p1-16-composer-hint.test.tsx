import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/src/test/render';
import { ChatComposer } from '@/src/features/chat/components/ChatComposer';

function renderComposer() {
  return renderWithProviders(
    <ChatComposer onSendMessage={() => {}} onCancelStream={() => {}} isStreaming={false} />
  );
}

describe('P1-16 composer shortcuts hint', () => {
  it('shows exactly the keyboard hint, without implementation details', () => {
    renderComposer();
    const hint = document.getElementById('composer-shortcuts-hint');
    expect(hint).not.toBeNull();
    const text = (hint!.textContent ?? '').trim();
    expect(text).toBe('Invio per inviare, Shift+Invio per a capo.');
    expect(text).not.toMatch(/ndjson/i);
    expect(text).not.toMatch(/bounding/i);
  });

  it('textarea aria-describedby references the hint element', () => {
    renderComposer();
    const box = screen.getByRole('textbox', { name: 'Domanda sui documenti' });
    const ids = (box.getAttribute('aria-describedby') ?? '').split(/\s+/);
    expect(ids).toContain('composer-shortcuts-hint');
    expect(document.getElementById('composer-shortcuts-hint')).not.toBeNull();
  });
});
