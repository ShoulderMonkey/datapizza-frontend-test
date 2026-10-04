import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/src/mocks/server';
import { ndjsonResponse } from '@/src/mocks/ndjson';
import { renderWithProviders } from '@/src/test/render';
import { ChatWorkspace } from '@/src/features/chat/components/ChatWorkspace';
import { DocumentListModal } from '@/src/features/documents/components/DocumentListModal';
import { ERROR_MESSAGES } from '@/src/api';

const UPLOAD_DETAIL = "File 'non-ammesso.pdf' is not recognized. Please upload one of the provided test documents.";
const TOO_LONG_DETAIL = 'Query is too long. Maximum length is 10000 characters.';

let errorSpy: MockInstance<(...args: unknown[]) => void>;
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const loggedArgs = () => JSON.stringify(errorSpy.mock.calls.map((c) => (c as unknown[]).map((a: unknown) => (a instanceof Error ? a.message : a))));

async function uploadRejectedPdf() {
  server.use(http.post('*/api/documents/', () => HttpResponse.json({ detail: UPLOAD_DETAIL }, { status: 400 })));
  const user = userEvent.setup();
  const { container } = renderWithProviders(
    <DocumentListModal isOpen onClose={() => {}} onOpenPdfViewer={() => {}} />
  );
  await user.click(screen.getByRole('button', { name: /carica nuovi pdf/i }));
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  await user.upload(input, new File(['%PDF-1.4'], 'non-ammesso.pdf', { type: 'application/pdf' }));
  await user.click(screen.getByRole('button', { name: /carica 1 file/i }));
}

describe('upload 400 "not recognized"', () => {
  it('shows the Italian message with the filename and never the English backend detail', async () => {
    await uploadRejectedPdf();
    expect(await screen.findByText(/«non-ammesso\.pdf»/)).toBeInTheDocument();
    expect(document.body.textContent).toContain(ERROR_MESSAGES.upload_not_recognized({ filename: 'non-ammesso.pdf' }));
    expect(document.body.textContent).not.toMatch(/is not recognized|Please upload one of/i);
    expect(document.body.textContent).not.toMatch(/\b400\b/);
  });

  it('logs the technical cause (backend body) to console.error only', async () => {
    await uploadRejectedPdf();
    await screen.findByText(/«non-ammesso\.pdf»/);
    expect(errorSpy).toHaveBeenCalled();
    const causes = errorSpy.mock.calls.flat();
    expect(causes).toContainEqual({ detail: UPLOAD_DETAIL });
  });
});

describe('chat 400 too long', () => {
  it('shows the mapped message, not the English detail', async () => {
    server.use(http.post('*/api/chat/', () => HttpResponse.json({ detail: TOO_LONG_DETAIL }, { status: 400 })));
    const user = userEvent.setup();
    renderWithProviders(<ChatWorkspace userId="u1" onLogout={() => {}} />);
    await user.type(screen.getByRole('textbox'), 'domanda');
    await user.click(screen.getByRole('button', { name: /invia/i }));

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain(ERROR_MESSAGES.query_too_long);
    expect(document.body.textContent).not.toMatch(/Maximum length|too long/i);
    expect(document.body.textContent).not.toMatch(/\b400\b/);
  });
});

describe('stream error chunk', () => {
  it('shows the mapped message, hides the backend text and logs it to console.error', async () => {
    server.use(
      http.post('*/api/chat/', () =>
        ndjsonResponse([
          '{"type":"content","delta":"Parziale"}\n',
          '{"type":"error","message":"Streaming error: boom internal"}\n',
        ])
      )
    );
    const user = userEvent.setup();
    renderWithProviders(<ChatWorkspace userId="u1" onLogout={() => {}} />);
    await user.type(screen.getByRole('textbox'), 'domanda');
    await user.click(screen.getByRole('button', { name: /invia/i }));

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain(ERROR_MESSAGES.stream_error_chunk);
    expect(document.body.textContent).not.toMatch(/Streaming error|boom internal/);
    expect(loggedArgs()).toContain('boom internal');
  });
});
