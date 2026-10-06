import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/src/mocks/server';
import { renderWithProviders } from '@/src/test/render';
import { ChatWorkspace } from '@/src/features/chat/components/ChatWorkspace';

// Backend timestamps are UTC without offset; Europe/Rome is UTC+2 in October.
const REC = {
  id: 'A',
  user_id: 'u1',
  created_at: '2026-10-06T13:03:46.422580',
  query: 'Domanda storica',
  response: 'Risposta storica',
};

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  server.use(
    http.get('*/api/chat/', () => HttpResponse.json([REC])),
    http.get('*/api/chat/A', () => HttpResponse.json(REC))
  );
});
afterEach(() => vi.restoreAllMocks());

describe('history timezone (P1-21)', () => {
  it('shows the sidebar entry in local time (15:03, not 13:03)', async () => {
    renderWithProviders(<ChatWorkspace userId="u1" onLogout={() => {}} />);
    const entry = await screen.findByTestId('history-entry');
    expect(within(entry).getByText(/15:03/)).toBeInTheDocument();
    expect(within(entry).queryByText(/13:03/)).not.toBeInTheDocument();
  });

  it('shows loaded history messages at 15:03 too', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ChatWorkspace userId="u1" onLogout={() => {}} />);
    await user.click(await screen.findByRole('button', { name: /Domanda storica/ }));
    await screen.findByText('Risposta storica');
    const times = screen.getAllByText(/^15:03$/);
    expect(times.length).toBeGreaterThanOrEqual(2); // user + assistant message
    expect(screen.queryByText(/^13:03$/)).not.toBeInTheDocument();
  });
});
