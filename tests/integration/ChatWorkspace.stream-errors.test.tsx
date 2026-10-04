import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/src/mocks/server';
import { ndjsonResponse } from '@/src/mocks/ndjson';
import { ChatWorkspace } from '@/components/chat/ChatWorkspace';

const content = (d: string) => JSON.stringify({ type: 'content', delta: d }) + '\n';

function useStream(chunks: string[]) {
  server.use(http.post('*/api/chat/', () => ndjsonResponse(chunks)));
}

async function send(text = 'domanda') {
  const user = userEvent.setup();
  render(<ChatWorkspace userId="u1" onLogout={() => {}} />);
  await user.type(screen.getByRole('textbox'), text);
  await user.click(screen.getByRole('button', { name: /invia/i }));
}

beforeEach(() => {
  // jsdom does not implement scrollIntoView
  Element.prototype.scrollIntoView = vi.fn();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('ChatWorkspace stream errors', () => {
  it('keeps status error (not overwritten by completed) after an error chunk, with partial text and friendly banner', async () => {
    useStream([
      content('Uno '),
      content('due '),
      content('tre'),
      '{"type":"error","message":"Streaming error: x"}\n',
    ]);
    await send();

    const banner = await screen.findByRole('alert');
    expect(screen.getByText(/Uno due tre/)).toBeInTheDocument();
    expect(banner.textContent).not.toMatch(/Streaming error/i);
    expect(banner.textContent?.trim().length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toMatch(/Streaming error/i);
    // Hook required from the developer: data-status on the assistant message.
    const msg = document.querySelector('[data-status]');
    expect(msg).not.toBeNull();
    expect(document.querySelector('[data-status="error"]')).not.toBeNull();
    expect(document.querySelector('[data-status="completed"][data-role="assistant"]')).toBeNull();
  });

  it('shows a visible error for a non-JSON line without crashing, keeping earlier content', async () => {
    useStream([content('Prima '), 'not json\n', content('dopo')]);
    await send();

    const banner = await screen.findByRole('alert');
    expect(banner.textContent?.trim().length).toBeGreaterThan(0);
    expect(screen.getByText(/Prima/)).toBeInTheDocument();
    expect(document.querySelector('[data-status="error"]')).not.toBeNull();
  });

  it('ignores an unknown chunk type and keeps streaming subsequent content', async () => {
    useStream([content('Alfa '), '{"type":"ping"}\n', content('Beta')]);
    await send();

    expect(await screen.findByText(/Alfa Beta/)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(within(document.body).queryByText(/Risposta interrotta/)).not.toBeInTheDocument();
  });
});
