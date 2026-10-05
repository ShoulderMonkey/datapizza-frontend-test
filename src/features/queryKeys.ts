/** Central TanStack Query keys. Invalidate by prefix (e.g. `queryKeys.chats.all`). */
export const queryKeys = {
  documents: {
    all: ['documents'] as const,
    list: () => ['documents', 'list'] as const,
    /** Downloaded PDF Blob, shared by citation thumbnails and the viewer. */
    file: (id: string) => ['documents', 'file', id] as const,
    /** Parsed pdf.js document (PDFDocumentProxy) shared by all thumbnails of a document. */
    proxy: (id: string) => ['documents', 'proxy', id] as const,
  },
  chats: {
    all: ['chats'] as const,
    list: () => ['chats', 'list'] as const,
  },
  chat: {
    detail: (id: string) => ['chat', id] as const,
  },
};
