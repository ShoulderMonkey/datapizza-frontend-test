import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useQuery } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/src/mocks/server';
import { renderWithProviders } from '@/src/test/render';
import { documentService } from '@/src/api';
import { queryKeys } from '@/src/features/queryKeys';
import { DocumentUploadDropzone } from '@/src/features/documents/components/DocumentUploadDropzone';

/** Stands in for the documents list: its GET count shows whether the list was invalidated/refetched. */
function DocsProbe() {
  const { data } = useQuery({ queryKey: queryKeys.documents.list(), queryFn: () => documentService.listDocuments(0) });
  return <ul aria-label="lista">{(data ?? []).map((d) => <li key={d.id}>{d.filename}</li>)}</ul>;
}

const docs = [{ id: 'd1', filename: 'a.pdf', content_type: 'application/pdf', upload_date: '2025-01-01T00:00:00Z', status: 'completed', page_count: 1, file_hash: 'h' }];

let getCount = 0;
let postSignals: AbortSignal[] = [];
let releasePost: () => void = () => {};

function setup(onUploadSuccess = vi.fn(), pendingForever = true) {
  getCount = 0;
  postSignals = [];
  const gate = new Promise<void>((r) => { releasePost = r; });
  server.use(
    http.get('*/api/documents/', () => {
      getCount++;
      return HttpResponse.json(docs);
    }),
    http.post('*/api/documents/', async ({ request }) => {
      postSignals.push(request.signal);
      if (pendingForever) await new Promise<void>((resolve) => request.signal.addEventListener('abort', () => resolve()));
      else await gate;
      return HttpResponse.json({ message: 'ok' });
    }),
  );
  renderWithProviders(<><DocsProbe /><DocumentUploadDropzone onUploadSuccess={onUploadSuccess} /></>);
  return onUploadSuccess;
}

async function selectAndStart(user: ReturnType<typeof userEvent.setup>) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  await user.upload(input, new File(['%PDF-1.4'], 'nuovo.pdf', { type: 'application/pdf' }));
  await user.click(screen.getByRole('button', { name: 'Carica 1 file' }));
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('upload cancellation (P2-05)', () => {
  it('"Annulla" is shown only while uploading and aborts the request without success/error messages or list refetch', async () => {
    const abortSpy = vi.spyOn(AbortController.prototype, 'abort');
    const onSuccess = setup();
    const user = userEvent.setup();
    await screen.findByText('a.pdf');
    expect(getCount).toBe(1);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, new File(['%PDF-1.4'], 'nuovo.pdf', { type: 'application/pdf' }));
    expect(screen.queryByRole('button', { name: 'Annulla' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Carica 1 file' }));
    const cancel = await screen.findByRole('button', { name: 'Annulla' });
    expect(screen.getByRole('button', { name: 'Caricamento in corso...' })).toBeDisabled();
    await waitFor(() => expect(postSignals).toHaveLength(1));
    expect(postSignals[0].aborted).toBe(false);

    abortSpy.mockClear();
    await user.click(cancel);

    expect(abortSpy).toHaveBeenCalled();
    await waitFor(() => expect(postSignals[0].aborted).toBe(true));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Annulla' })).not.toBeInTheDocument());

    expect(screen.queryByText(/Errore caricamento/)).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText(/caricato\/i con successo/)).not.toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
    // File stays selected and can be retried.
    expect(screen.getByRole('button', { name: 'Carica 1 file' })).toBeEnabled();
    expect(screen.getByText('nuovo.pdf')).toBeInTheDocument();
    // Documents list unchanged: no refetch happened.
    await new Promise((r) => setTimeout(r, 50));
    expect(getCount).toBe(1);
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('without cancelling, the upload succeeds: success message, onUploadSuccess and list invalidation', async () => {
    const onSuccess = setup(vi.fn(), false);
    const user = userEvent.setup();
    await screen.findByText('a.pdf');
    await selectAndStart(user);
    await screen.findByRole('button', { name: 'Annulla' });
    releasePost();

    await screen.findByText('1 documento/i caricato/i con successo!');
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Annulla' })).not.toBeInTheDocument();
    await waitFor(() => expect(getCount).toBe(2));
  });
});
