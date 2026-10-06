import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WelcomePanel, SUGGESTED_QUESTION } from '@/src/features/chat/components/WelcomePanel';

function setup() {
  const onOpenDocuments = vi.fn();
  const onAskQuestion = vi.fn();
  const utils = render(<WelcomePanel onOpenDocuments={onOpenDocuments} onAskQuestion={onAskQuestion} />);
  return { ...utils, onOpenDocuments, onAskQuestion };
}

describe('WelcomePanel (P1-17)', () => {
  it('non contiene gergo tecnico nel testo renderizzato', () => {
    const { container } = setup();
    expect(container.textContent ?? '').not.toMatch(/ndjson|multipart|form-data|bounding|rects_in|streaming/i);
    expect(container.querySelector('code')).toBeNull();
  });

  it('mostra titolo e le tre card', () => {
    setup();
    expect(screen.getByRole('heading', { name: /benvenuto/i })).toBeInTheDocument();
    expect(screen.getByText('1. Carica PDF')).toBeInTheDocument();
    expect(screen.getByText('2. Fai una domanda')).toBeInTheDocument();
    expect(screen.getByText('3. Controlla le fonti')).toBeInTheDocument();
  });

  it('la card "Carica PDF" apre i documenti', async () => {
    const { onOpenDocuments, onAskQuestion } = setup();
    await userEvent.click(screen.getByRole('button', { name: /1\. Carica PDF/ }));
    expect(onOpenDocuments).toHaveBeenCalledTimes(1);
    expect(onAskQuestion).not.toHaveBeenCalled();
  });

  it('la card "Fai una domanda" invia la domanda suggerita', async () => {
    const { onOpenDocuments, onAskQuestion } = setup();
    await userEvent.click(screen.getByRole('button', { name: /2\. Fai una domanda/ }));
    expect(onAskQuestion).toHaveBeenCalledWith(SUGGESTED_QUESTION);
    expect(onOpenDocuments).not.toHaveBeenCalled();
  });

  it('la card "Controlla le fonti" non e un bottone', () => {
    setup();
    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /controlla le fonti/i })).toBeNull();
  });
});
