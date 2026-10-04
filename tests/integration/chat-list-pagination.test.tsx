import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import { server } from '@/src/mocks/server';
import { paginatedListHandler } from '@/src/mocks/paginated';
import { renderWithProviders } from '@/src/test/render';
import { ChatWorkspace } from '@/src/features/chat/components/ChatWorkspace';

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => vi.restoreAllMocks());

describe('sidebar with a paginated backend', () => {
  it('shows the newest of 25 chats (beyond the default page of 20) at the top', async () => {
    const chats = Array.from({ length: 25 }, (_, i) => ({
      id: `c${i + 1}`,
      user_id: 'u1',
      created_at: new Date(Date.UTC(2025, 0, 1, 0, i)).toISOString(),
      query: `Domanda numero ${i + 1}`,
      response: `Risposta ${i + 1}`,
    }));
    server.use(paginatedListHandler('*/api/chat/', chats));
    renderWithProviders(<ChatWorkspace userId="u1" onLogout={() => {}} />);

    const newest = await screen.findByText('Domanda numero 25');
    const oldest = screen.getByText('Domanda numero 1');
    expect(newest.compareDocumentPosition(oldest) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
