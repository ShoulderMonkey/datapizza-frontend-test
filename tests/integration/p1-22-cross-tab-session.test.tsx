// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/src/mocks/server';
import HomePage from '@/app/page';
import { installMemoryLocalStorage } from '@/src/test/memoryStorage';
import { resetUnauthorizedGuard } from '@/src/api';

const KEY = 'docfact_auth_user_id';
const rec = (id: string, userId: string, query: string) => ({
  id, user_id: userId, created_at: '2025-01-01T10:00:00Z', query, response: `Risposta ${id} di ${userId}`,
});

/** Simulates another tab changing the stored user: update storage, then fire the `storage` event (no storageArea: the in-memory stub is not a jsdom Storage). */
function otherTabSets(newValue: string | null) {
  const oldValue = localStorage.getItem(KEY);
  if (newValue === null) localStorage.removeItem(KEY);
  else localStorage.setItem(KEY, newValue);
  act(() => {
    window.dispatchEvent(
      new StorageEvent('storage', { key: KEY, oldValue, newValue })
    );
  });
}

let chatCalls = 0;
let docCalls = 0;
beforeEach(() => {
  resetUnauthorizedGuard();
  installMemoryLocalStorage();
  localStorage.setItem(KEY, 'x1');
  Element.prototype.scrollIntoView = vi.fn();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  chatCalls = 0;
  docCalls = 0;
  server.use(
    http.get('*/api/chat/', () => {
      chatCalls += 1;
      const user = localStorage.getItem(KEY) ?? 'none';
      return HttpResponse.json([rec(user === 'x1' ? '1' : '2', user, `Domanda di ${user}`)]);
    }),
    http.get('*/api/chat/:id', ({ params }) => {
      const user = localStorage.getItem(KEY) ?? 'none';
      return HttpResponse.json(rec(String(params.id), user === 'x1' ? 'x1' : user, `Domanda di ${user}`));
    }),
    http.get('*/api/documents/', () => {
      docCalls += 1;
      return HttpResponse.json([]);
    })
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('cross-tab session sync (storage event)', () => {
  it('logout in another tab returns this tab to the login form without reload', async () => {
    render(<HomePage />);
    expect(await screen.findByText('x1')).toBeInTheDocument();

    otherTabSets(null);

    expect(await screen.findByLabelText('User ID')).toBeInTheDocument();
    expect(screen.queryByText('x1')).not.toBeInTheDocument();
  });

  it('a different user logging in on another tab replaces x1, resets the conversation and reloads lists', async () => {
    const user = userEvent.setup();
    render(<HomePage />);
    expect(await screen.findByText('x1')).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: /Domanda di x1/ }));
    expect((await screen.findAllByText(/Risposta 1 di x1/)).length).toBeGreaterThan(0);

    const chatBefore = chatCalls;
    const docsBefore = docCalls;
    otherTabSets('x2');

    expect(await screen.findByText('x2')).toBeInTheDocument();
    expect(screen.queryByText('x1')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(/Risposta 1 di x1/)).not.toBeInTheDocument());
    expect(screen.queryByText('Domanda di x1')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(chatCalls).toBeGreaterThan(chatBefore);
      expect(docCalls).toBeGreaterThan(docsBefore);
    });
    expect(await screen.findByText('Domanda di x2')).toBeInTheDocument();
  });
});
