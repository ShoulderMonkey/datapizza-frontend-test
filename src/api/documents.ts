import { request, requestRaw } from './client';
import { fetchAllPages } from './pagination';
import { createApiError } from './errors';
import { message } from './errorMessages';
import type { Document, UploadResponse } from './types';

export function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

export const documentService = {
  /** GET /api/documents/: every page (limit=100). */
  async listDocuments(signal?: AbortSignal): Promise<Document[]> {
    return fetchAllPages<Document>('/api/documents/', { signal });
  },

  /** POST /api/documents/ as multipart/form-data with field name `files`. */
  async uploadDocuments(files: File[]): Promise<UploadResponse> {
    if (!files || files.length === 0) {
      throw createApiError('client_validation', {
        userMessage: message('upload_no_file'),
        endpoint: '/api/documents/',
      });
    }
    for (const file of files) {
      if (!isPdfFile(file)) {
        throw createApiError('client_validation', {
          userMessage: message('upload_not_pdf', { filename: file.name }),
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
    });
  },

  /** GET /api/documents/{id}/file as a Blob. */
  async getDocumentFile(documentId: string, signal?: AbortSignal): Promise<Blob> {
    const response = await requestRaw(documentService.getDocumentFileUrl(documentId), {
      method: 'GET',
      signal,
    });
    return response.blob();
  },

  /** Relative URL of the document file endpoint. */
  getDocumentFileUrl(documentId: string): string {
    return `/api/documents/${encodeURIComponent(documentId)}/file`;
  },
};
