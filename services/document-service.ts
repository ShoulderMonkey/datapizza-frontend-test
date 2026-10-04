import { rawRequest, request } from './api-client';
import { DocumentItem, DocumentUploadResponse } from '@/types/document';
import { getApiBaseUrl } from '@/config/api';

export const documentService = {
  /**
   * Fetches the list of all uploaded documents.
   */
  async listDocuments(): Promise<DocumentItem[]> {
    const data = await request<unknown>('/api/documents/', {
      method: 'GET',
    });

    if (Array.isArray(data)) {
      return data.map(normalizeDocumentItem);
    }
    if (data && typeof data === 'object') {
      const obj = data as Record<string, unknown>;
      if (Array.isArray(obj.documents)) {
        return obj.documents.map(normalizeDocumentItem);
      }
      if (Array.isArray(obj.files)) {
        return obj.files.map(normalizeDocumentItem);
      }
      if (Array.isArray(obj.items)) {
        return obj.items.map(normalizeDocumentItem);
      }
    }
    return [];
  },

  /**
   * Uploads one or more PDF files via multipart/form-data with field name 'files'.
   */
  async uploadDocuments(files: File[]): Promise<DocumentUploadResponse> {
    if (!files || files.length === 0) {
      throw new Error('Nessun file selezionato per il caricamento.');
    }

    // Validate that files are PDFs
    for (const file of files) {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      if (!isPdf) {
        throw new Error(`Il file "${file.name}" non è un documento PDF valido.`);
      }
    }

    const formData = new FormData();
    for (const file of files) {
      formData.append('files', file);
    }

    const response = await request<DocumentUploadResponse>('/api/documents/', {
      method: 'POST',
      body: formData,
    });

    return response;
  },

  /**
   * Retrieves the raw PDF document blob.
   */
  async getDocumentFile(documentId: string): Promise<Blob> {
    const encodedId = encodeURIComponent(documentId);
    const response = await rawRequest(`/api/documents/${encodedId}/file`, {
      method: 'GET',
    });

    return await response.blob();
  },

  /**
   * Generates a direct URL to the document file endpoint.
   */
  getDocumentFileUrl(documentId: string): string {
    const baseUrl = getApiBaseUrl();
    const encodedId = encodeURIComponent(documentId);
    return `${baseUrl}/api/documents/${encodedId}/file`;
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
