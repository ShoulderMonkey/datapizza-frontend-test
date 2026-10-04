import { request, requestRaw } from './client';
import { createApiError } from './errors';
import type { Document, UploadResponse } from './types';

export function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

export const documentService = {
  /** GET /api/documents/ */
  async listDocuments(): Promise<Document[]> {
    return request<Document[]>('/api/documents/', { method: 'GET' });
  },

  /** POST /api/documents/ as multipart/form-data with field name `files`. */
  async uploadDocuments(files: File[]): Promise<UploadResponse> {
    if (!files || files.length === 0) {
      throw createApiError('client_validation', {
        userMessage: 'Nessun file selezionato per il caricamento.',
        endpoint: '/api/documents/',
      });
    }
    for (const file of files) {
      if (!isPdfFile(file)) {
        throw createApiError('client_validation', {
          userMessage: `Il file "${file.name}" non è un documento PDF valido.`,
          endpoint: '/api/documents/',
        });
      }
    }

    const formData = new FormData();
    for (const file of files) {
      formData.append('files', file);
    }

    return request<UploadResponse>('/api/documents/', {
      method: 'POST',
      body: formData,
      errorMessages: {
        // BE:src/routes/documents.py:54-57: only the provided test documents are accepted.
        bad_request: 'Uno o più file non sono tra i documenti di test riconosciuti dal backend.',
        validation: 'Il backend non ha ricevuto alcun file. Seleziona almeno un PDF.',
      },
    });
  },

  /** GET /api/documents/{id}/file as a Blob. */
  async getDocumentFile(documentId: string, signal?: AbortSignal): Promise<Blob> {
    const response = await requestRaw(documentService.getDocumentFileUrl(documentId), {
      method: 'GET',
      signal,
      errorMessages: { not_found: 'Il file PDF richiesto non è disponibile sul server.' },
    });
    return response.blob();
  },

  /** Relative URL of the document file endpoint. */
  getDocumentFileUrl(documentId: string): string {
    return `/api/documents/${encodeURIComponent(documentId)}/file`;
  },
};
