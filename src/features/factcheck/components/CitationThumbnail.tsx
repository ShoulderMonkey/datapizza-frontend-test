'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { FileText } from 'lucide-react';
import { logError } from '@/src/api';
import type { CitationReference } from '../types';
import { useDocumentFile } from '../hooks/useDocumentFile';

// react-pdf touches window at import time: load it client-side only (same pattern as PdfPageView).
const CitationThumbnailPage = dynamic(
  () => import('./CitationThumbnailPage').then((m) => m.CitationThumbnailPage),
  { ssr: false, loading: () => null }
);

/** Rendered page width and fixed placeholder size (no layout shift when the page appears). */
export const THUMBNAIL_WIDTH_PX = 140;
export const THUMBNAIL_HEIGHT_PX = 180; // same box as THUMBNAIL_BOX_* in CitationThumbnailPage
const ROOT_MARGIN = '200px';

type ThumbnailState = 'idle' | 'loading' | 'rendered' | 'error';

interface CitationThumbnailProps {
  citation: CitationReference;
}

/**
 * Decorative mini-preview of the cited page with the region rectangles, rendered lazily.
 * - Until the element intersects the viewport (IntersectionObserver, rootMargin 200px) it is a
 *   fixed-size placeholder and NO network request is made (state "idle").
 * - Without IntersectionObserver (jsdom, very old browsers) it stays "idle" forever: it never
 *   renders eagerly. Tests must mock IntersectionObserver and trigger an intersection.
 * - The observer disconnects after the first intersection.
 * - Download errors or render errors fall back silently to the placeholder (state "error").
 * The PDF Blob comes from the query cache shared with the viewer (one download per document_id).
 */
export function CitationThumbnail({ citation }: CitationThumbnailProps) {
  const containerRef = useRef<HTMLSpanElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isRendered, setIsRendered] = useState(false);
  const [renderFailed, setRenderFailed] = useState(false);

  useEffect(() => {
    const node = containerRef.current;
    if (isVisible || !node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: ROOT_MARGIN }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [isVisible]);

  const fileQuery = useDocumentFile(citation.document_id, isVisible);
  const file = fileQuery.data ?? null;

  let state: ThumbnailState = 'idle';
  if (fileQuery.isError || renderFailed) state = 'error';
  else if (isRendered) state = 'rendered';
  else if (isVisible) state = 'loading';

  const fail = useCallback((err: unknown) => {
    logError('Citation thumbnail failed:', err);
    setRenderFailed(true);
  }, []);
  const rendered = useCallback(() => setIsRendered(true), []);

  return (
    <span
      ref={containerRef}
      aria-hidden="true"
      data-testid="citation-thumbnail"
      data-state={state}
      style={{ width: THUMBNAIL_WIDTH_PX, height: THUMBNAIL_HEIGHT_PX }}
      className="relative block shrink-0 overflow-hidden rounded border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800"
    >
      {state !== 'rendered' && (
        <span className="absolute inset-0 flex items-center justify-center text-slate-400 dark:text-slate-500">
          <FileText className="w-6 h-6" />
        </span>
      )}
      {file && !renderFailed && (
        <CitationThumbnailPage
          file={file}
          citation={citation}
          onRendered={rendered}
          onFail={fail}
        />
      )}
    </span>
  );
}
