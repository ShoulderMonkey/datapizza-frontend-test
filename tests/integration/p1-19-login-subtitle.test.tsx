import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LoginForm } from '@/src/features/auth/components/LoginForm';

describe('LoginForm subtitle (P1-19)', () => {
  it('shows a plain Italian subtitle right after the heading', () => {
    render(<LoginForm onLoginSuccess={vi.fn()} />);
    const heading = screen.getByRole('heading', { name: 'DocFact Assistant' });
    const subtitle = heading.nextElementSibling;
    expect(subtitle?.tagName).toBe('P');
    expect(subtitle?.textContent?.trim()).toBe(
      'Fai domande sui tuoi PDF e verifica le risposte sulle fonti.'
    );
  });

  it('does not leak implementation details anywhere in the login', () => {
    render(<LoginForm onLoginSuccess={vi.fn()} />);
    expect(document.body.textContent).not.toMatch(/ndjson|streaming|grounded/i);
  });
});
