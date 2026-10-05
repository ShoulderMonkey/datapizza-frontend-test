'use client';

import { useQuery, type QueryCache } from '@tanstack/react-query';
import { pdfjs } from 'react-pdf';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { queryKeys } from '../../queryKeys';
import '../lib/pdfWorker';

/**
 * NOTE: this module imports react-pdf (it touches `window` at import time). Import it only from
 * client-only components loaded with next/dynamic ssr:false (CitationThumbnailPage).
 */

/** Parsed documents are kept 5 minutes after the last thumbnail unmounts, then destroyed. */
const PROXY_GC_TIME_MS = 5 * 60 * 1000;

const watchedCaches = new WeakSet<QueryCache>();

/** Frees the pdf.js worker resources when a proxy query is removed from the cache (gc, remove, or queryClient.clear(), which emits 'removed' per query). */
function destroyOnRemoval(cache: QueryCache) {
  if (watchedCaches.has(cache)) return;
  watchedCaches.add(cache);
  cache.subscribe((event) => {
    if (event.type !== 'removed') return;
    const [scope, kind] = event.query.queryKey;
    const [proxyScope, proxyKind] = queryKeys.documents.proxy('');
    if (scope !== proxyScope || kind !== proxyKind) return;
    const data = event.query.state.data as PDFDocumentProxy | undefined;
    void data?.loadingTask.destroy();
  });
}

/**
 * Parses the PDF Blob ONCE per document_id with pdf.js and shares the PDFDocumentProxy between all
 * the citation thumbnails of that document (the Blob itself comes from useDocumentFile).
 * `<Page pdf={proxy}>` of react-pdf renders from it without a second parse.
 */
export function useDocumentProxy(documentId: string, file: Blob | null) {
  return useQuery({
    queryKey: queryKeys.documents.proxy(documentId),
    queryFn: async ({ client }) => {
      destroyOnRemoval(client.getQueryCache());
      const key = queryKeys.documents.proxy(documentId);
      const previous = client.getQueryData<PDFDocumentProxy>(key);
      const data = new Uint8Array(await (file as Blob).arrayBuffer());
      const next = await pdfjs.getDocument({ data }).promise;
      // A refetch replaces the proxy: destroy the old one so no PDFDocumentProxy is left orphaned.
      if (previous && previous !== next) void previous.loadingTask.destroy();
      return next;
    },
    enabled: file !== null,
    staleTime: Infinity,
    gcTime: PROXY_GC_TIME_MS,
    retry: false,
  });
}
