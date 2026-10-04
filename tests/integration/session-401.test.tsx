// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { http, HttpResponse, delay } from 'msw';
import { server } from '@/src/mocks/server';
import HomePage from '@/app/page';
import { installMemoryLocalStorage } from '@/src/test/memoryStorage';
import { resetUnauthorizedGuard, setUnauthorizedHandler, notifyUnauthorized } from '@/src/api';

const KEY = 'docfact_auth_user_id';
const EXPIRED = 'Sessione scaduta, accedi di nuovo';
const unauthorized = () => HttpResponse.json({ detail: 'Not authenticated' }, { status: 401 });
const chatRec = (id: string, query: string) => ({
  id, user_id: 'x', created_at: '2025-01-01T10:00:00Z', query, response: `R ${id}`,
});

let storage: ReturnType<typeof installMemoryLocalStorage>;
beforeEach(() => {
  resetUnauthorizedGuard();
  storage = installMemoryLocalStorage();
  localStorage.setItem(KEY, 'alice');
  Element.prototype.scrollIntoView = vi.fn();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function expectLoginWithExpiredNotice() {
  expect(await screen.findByRole('alert')).toHaveTextContent(EXPIRED);
  expect(screen.getByLabelText('User ID')).toBeInTheDocument();
  expect(localStorage.getItem(KEY)).toBeNull();
}

describe('global 401 handling', () => {
  it('GET /api/chat/ 401 returns to the login with the expired-session message', async () => {
    server.use(http.get('*/api/chat/', unauthorized));
    render(<HomePage />);
    await expectLoginWithExpiredNotice();
  });

  it('GET /api/documents/ 401 returns to the login with the expired-session message', async () => {
    server.use(http.get('*/api/documents/', unauthorized));
    render(<HomePage />);
    await expectLoginWithExpiredNotice();
  });

  it('POST /api/chat/ (stream) 401 returns to the login with the expired-session message', async () => {
    server.use(http.post('*/api/chat/', unauthorized));
    const user = userEvent.setup();
    render(<HomePage />);
    await user.type(await screen.findByRole('textbox'), 'domanda');
    await user.click(screen.getByRole('button', { name: /invia/i }));
    await expectLoginWithExpiredNotice();
  });

  it('401 on /api/auth/login does not trigger the global handler', async () => {
    localStorage.clear();
    const handler = vi.fn();
    server.use(http.post('*/api/auth/login', unauthorized));
    const user = userEvent.setup();
    render(<HomePage />);
    const unsubscribe = setUnauthorizedHandler(handler);
    await user.click(await screen.findByRole('button', { name: /accedi all/i }));
    await waitFor(() => expect(screen.queryByText(/accesso in corso/i)).not.toBeInTheDocument());
    expect(handler).not.toHaveBeenCalled();
    expect(screen.queryByText(EXPIRED)).not.toBeInTheDocument();
    unsubscribe();
  });

  it('concurrent 401s notify the handler only once', () => {
    const handler = vi.fn();
    const unsubscribe = setUnauthorizedHandler(handler);
    notifyUnauthorized();
    notifyUnauthorized();
    notifyUnauthorized();
    expect(handler).toHaveBeenCalledTimes(1);
    resetUnauthorizedGuard();
    notifyUnauthorized();
    expect(handler).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it('chat and documents both returning 401 at mount produce a single, consistent login screen', async () => {
    server.use(http.get('*/api/chat/', unauthorized), http.get('*/api/documents/', unauthorized));
    render(<HomePage />);
    await expectLoginWithExpiredNotice();
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });

  it('the expired-session message disappears after a new login', async () => {
    server.use(http.get('*/api/chat/', unauthorized));
    const user = userEvent.setup();
    render(<HomePage />);
    await expectLoginWithExpiredNotice();
    server.use(http.get('*/api/chat/', () => HttpResponse.json([])));
    await user.click(screen.getByRole('button', { name: /accedi all/i }));
    await waitFor(() => expect(screen.queryByText(EXPIRED)).not.toBeInTheDocument());
    expect(screen.queryByLabelText('User ID')).not.toBeInTheDocument();
    expect(localStorage.getItem(KEY)).toBe('test_user');
  });
});

describe('no localStorage access during render', () => {
  it('renderToString of HomePage does not read localStorage and shows the loading placeholder', () => {
    const getItem = storage.getItem;
    getItem.mockClear();
    const html = renderToString(<HomePage />);
    expect(getItem).not.toHaveBeenCalled();
    expect(html).toContain('role="status"');
    expect(html).not.toContain('User ID');
  });

  it('first client render is the placeholder; localStorage is read only after mount', async () => {
    const getItem = storage.getItem;
    getItem.mockClear();
    const { container } = render(<HomePage />);
    // render() flushes effects; the stored user is then applied
    expect(getItem).toHaveBeenCalledWith(KEY);
    expect(container).toBeDefined();
    expect(await screen.findByText('alice')).toBeInTheDocument();
  });
});

describe('logout', () => {
  it('clears the stored user and the query cache: the next user never sees the previous chats', async () => {
    server.use(http.get('*/api/chat/', () => HttpResponse.json([chatRec('1', 'Domanda di alice')])));
    const user = userEvent.setup();
    render(<HomePage />);
    expect(await screen.findByText('Domanda di alice')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /esci/i }));
    expect(await screen.findByLabelText('User ID')).toBeInTheDocument();
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    // second user: the chat list request is slow, the old data must not appear in the meantime
    server.use(
      http.get('*/api/chat/', async () => {
        await delay(400);
        return HttpResponse.json([chatRec('2', 'Domanda di bob')]);
      })
    );
    await user.click(screen.getByRole('button', { name: /reviewer_lead/ }));
    await user.click(screen.getByRole('button', { name: /accedi all/i }));
    expect(await screen.findByText('reviewer_lead')).toBeInTheDocument();
    expect(screen.queryByText('Domanda di alice')).not.toBeInTheDocument();
    expect(await screen.findByText('Domanda di bob')).toBeInTheDocument();
    expect(localStorage.getItem(KEY)).toBe('reviewer_lead');
  });
});
