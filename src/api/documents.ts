import { request, requestRaw } from './client';
import { createApiError } from './errors';
import type { DocumentItem, DocumentUploadResponse } from './types';

export function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

export const documentService = {
  /** GET /api/documents/ */
  async listDocuments(): Promise<DocumentItem[]> {
    const data = await request<unknown>('/api/documents/', { method: 'GET' });

    // Speculative shapes kept until P1-02 (the backend returns a bare array, docs/AUDIT.md §2).
    if (Array.isArray(data)) {
      return data.map(normalizeDocumentItem);
    }
    if (data && typeof data === 'object') {
      const obj = data as Record<string, unknown>;
      if (Array.isArray(obj.documents)) return obj.documents.map(normalizeDocumentItem);
      if (Array.isArray(obj.files)) return obj.files.map(normalizeDocumentItem);
      if (Array.isArray(obj.items)) return obj.items.map(normalizeDocumentItem);
    }
    return [];
  },

  /** POST /api/documents/ as multipart/form-data with field name `files`. */
  async uploadDocuments(files: File[]): Promise<DocumentUploadResponse> {
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

    return request<DocumentUploadResponse>('/api/documents/', {
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

function normalizeDocumentItem(item: unknown): DocumentItem {
  if (!item || typeof item !== 'object') {
    return { id: String(item ?? ''), filename: 'Sconosciuto' };
  }
  const obj = item as Record<string, unknown>;
  const id = String(obj.id ?? obj.document_id ?? obj.doc_id ?? '');
  const filename = String(obj.filename ?? obj.name ?? obj.file_name ?? `Documento ${id}`);
  const createdAt = obj.created_at ? String(obj.created_at) : obj.upload_date ? String(obj.upload_date) : undefined;
  const sizeBytes = typeof obj.size_bytes === 'number' ? obj.size_bytes : typeof obj.size === 'number' ? obj.size : undefined;
  const pageCount = typeof obj.page_count === 'number' ? obj.page_count : typeof obj.pages === 'number' ? obj.pages : undefined;

  return {
    ...obj,
    id,
    document_id: id,
    filename,
    created_at: createdAt,
    size_bytes: sizeBytes,
    page_count: pageCount,
  };
}
