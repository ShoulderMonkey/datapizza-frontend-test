'use client';

import { ERROR_MESSAGES } from '@/src/api';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { CitationReference } from '../types';
import { useDocumentProxy } from '../hooks/useDocumentProxy';
import { usePdfPageSizes } from '../hooks/usePdfPageSizes';
import { findPageAtLine, maxPageWidthPt } from '../lib/pageLayout';
import { PdfPageSlot } from './PdfPageSlot';

/**
 * Lazy rendering window (IntersectionObserver `rootMargin`, root = the scroll container): a page is
 * drawn (canvas + text layer) while it is within ONE container height above or below the visible
 * area, and released when it leaves that band. The pages about to be reached by scrolling are
 * ready in time, and the memory used by canvases stays bounded by a few pages whatever the length
 * of the document.
 */
export const RENDER_ROOT_MARGIN = '100% 0px';

/**
 * For this long after a navigation request (unless the user scrolls in the meantime), a zoom
 * change or the first render of the target page re-aligns the target region instead of keeping
 * the scroll anchor.
 */
const NAVIGATION_SETTLE_MS = 3000;

interface PdfPageViewProps {
  documentId: string;
  file: Blob;
  /** Page requested by the last navigation (1-based). */
  pageNumber: number;
  /** Changes on every navigation request: asking again for the same page scrolls again. */
  navigationSeq: number;
  /** true: bring the active (or first) region of `pageNumber` into view; false: show the page top. */
  alignToRegion: boolean;
  /** Zoom factor: 1 = 72 dpi (one CSS px per PDF point). */
  scale: number;
  citations: CitationReference[];
  activeCitation?: CitationReference | null;
  onSelectCitation?: (citation: CitationReference) => void;
  /** Scroll container of the pages (root of the lazy-rendering observer). */
  scrollContainerRef: RefObject<HTMLElement | null>;
  /** Page under the vertical centre of the scroll container, reported while scrolling. */
  onCurrentPageChange: (pageNumber: number) => void;
  onNumPages: (numPages: number) => void;
  /** Width in points of the WIDEST page (fit-to-width makes every page fit). */
  onPageWidthPt: (widthPt: number) => void;
  onLoadError: (message: string) => void;
}

/**
 * Continuous view of ALL the pages of the PDF, in a column inside the scroll container, with the
 * bounding-box overlay on each page. Client-only (react-pdf touches `window`): load with
 * next/dynamic ssr:false. The pdf.js document is the one parsed once per document_id and shared
 * with the citation thumbnails (useDocumentProxy).
 */
export function PdfPageView(props: PdfPageViewProps) {
  const { documentId, file, onNumPages, onLoadError } = props;
  const proxyQuery = useDocumentProxy(documentId, file);
  const pdf = proxyQuery.data;

  useEffect(() => {
    if (pdf) onNumPages(pdf.numPages);
  }, [pdf, onNumPages]);

  useEffect(() => {
    if (!proxyQuery.isError) return;
    console.error('pdf.js failed to load the document:', proxyQuery.error);
    onLoadError(ERROR_MESSAGES.pdf_render);
  }, [proxyQuery.isError, proxyQuery.error, onLoadError]);

  if (!pdf) {
    return proxyQuery.isError ? null : <RenderingMessage />;
  }
  // Keyed by document: page sizes, observers and scroll state start over with a new document.
  return <PdfPageList key={documentId} pdf={pdf} {...props} />;
}

function RenderingMessage() {
  return <div className="m-auto p-8 text-sm text-slate-500">Rendering del PDF...</div>;
}

interface NavigationState {
  page: number;
  toRegion: boolean;
  at: number;
  /** The first render of the target page has re-aligned it already. */
  aligned: boolean;
}

/** Point of the document under the centre of the container: page and fraction of its height. */
interface ScrollAnchor {
  page: number;
  fraction: number;
}

function PdfPageList({
  pdf,
  pageNumber,
  navigationSeq,
  alignToRegion,
  scale,
  citations,
  activeCitation,
  onSelectCitation,
  scrollContainerRef,
  onCurrentPageChange,
  onPageWidthPt,
  onLoadError,
}: PdfPageViewProps & { pdf: PDFDocumentProxy }) {
  const sizesState = usePdfPageSizes(pdf);
  const sizes = sizesState.status === 'success' ? sizesState.sizes : null;

  const pageElementsRef = useRef(new Map<number, HTMLDivElement>());
  const [pagesInRange, setPagesInRange] = useState<ReadonlySet<number>>(() => new Set());
  const navigationRef = useRef<NavigationState | null>(null);
  const anchorRef = useRef<ScrollAnchor | null>(null);
  const lastReportedPageRef = useRef<number | null>(null);

  useEffect(() => {
    if (sizesState.status !== 'error') return;
    console.error('pdf.js failed to read the page sizes:', sizesState.error);
    onLoadError(ERROR_MESSAGES.pdf_render);
  }, [sizesState, onLoadError]);

  useEffect(() => {
    if (sizes) onPageWidthPt(maxPageWidthPt(sizes));
  }, [sizes, onPageWidthPt]);

  const registerElement = useCallback((page: number, element: HTMLDivElement | null) => {
    if (element) pageElementsRef.current.set(page, element);
    else pageElementsRef.current.delete(page);
  }, []);

  const pageCount = sizes?.length ?? 0;

  /** Page under the vertical centre of the container (nearest page if the centre is in a gap). */
  const locateCenter = useCallback((): ScrollAnchor | null => {
    const container = scrollContainerRef.current;
    const elements = pageElementsRef.current;
    if (!container || pageCount === 0) return null;
    const y = container.getBoundingClientRect().top + container.clientHeight / 2;
    const index = findPageAtLine(
      pageCount,
      (i) => {
        const rect = elements.get(i + 1)?.getBoundingClientRect();
        return rect ? { top: rect.top, bottom: rect.bottom } : { top: y, bottom: y };
      },
      y
    );
    const rect = elements.get(index + 1)?.getBoundingClientRect();
    if (!rect) return null;
    return { page: index + 1, fraction: rect.height > 0 ? (y - rect.top) / rect.height : 0 };
  }, [pageCount, scrollContainerRef]);

  /** Brings the active (else first) box of `page` to the centre, or the page top into view. */
  const scrollToTarget = useCallback((page: number, toRegion: boolean, behavior: ScrollBehavior) => {
    const element = pageElementsRef.current.get(page);
    if (!element) return;
    const box = toRegion
      ? (element.querySelector<HTMLElement>('[data-testid="bbox"][data-active="true"]') ??
        element.querySelector<HTMLElement>('[data-testid="bbox"]'))
      : null;
    if (box) box.scrollIntoView?.({ block: 'center', inline: 'nearest', behavior });
    else element.scrollIntoView?.({ block: 'start', inline: 'nearest', behavior });
  }, []);

  // Current page + scroll anchor, at most once per frame while scrolling.
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || pageCount === 0) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const center = locateCenter();
      if (!center) return;
      anchorRef.current = center;
      if (center.page !== lastReportedPageRef.current) {
        lastReportedPageRef.current = center.page;
        onCurrentPageChange(center.page);
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    // The user takes over the scroll (wheel, touch, keys, scrollbar): the last navigation must
    // no longer be re-aligned by a zoom change or by the late render of its page.
    const onUserScrollIntent = () => {
      navigationRef.current = null;
    };
    const intents = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;
    container.addEventListener('scroll', onScroll, { passive: true });
    intents.forEach((type) => container.addEventListener(type, onUserScrollIntent, { passive: true }));
    return () => {
      container.removeEventListener('scroll', onScroll);
      intents.forEach((type) => container.removeEventListener(type, onUserScrollIntent));
      if (frame) cancelAnimationFrame(frame);
    };
  }, [pageCount, locateCenter, onCurrentPageChange, scrollContainerRef]);

  // Lazy rendering: track which pages are within the rendering band (RENDER_ROOT_MARGIN).
  const observerSupported = typeof IntersectionObserver !== 'undefined';
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || pageCount === 0 || !observerSupported) return;
    const observer = new IntersectionObserver(
      (entries) => {
        setPagesInRange((previous) => {
          let next: Set<number> | null = null;
          for (const entry of entries) {
            const page = Number((entry.target as HTMLElement).dataset.pageNumber);
            if (!Number.isInteger(page)) continue;
            const current = next ?? previous;
            if (entry.isIntersecting === current.has(page)) continue;
            next ??= new Set(previous);
            if (entry.isIntersecting) next.add(page);
            else next.delete(page);
          }
          return next ?? previous;
        });
      },
      { root: container, rootMargin: RENDER_ROOT_MARGIN }
    );
    pageElementsRef.current.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [pageCount, observerSupported, scrollContainerRef]);

  // Navigation request (toolbar, "Pag. N", citation): scroll to the page/region right away. The
  // placeholder already has the final size and carries the overlay, so the target position is
  // known before the page is drawn; scrolling there also brings the page into the rendering band.
  // Far jumps are instant, so the pages in between are not rendered on the way.
  useEffect(() => {
    if (pageCount === 0) return;
    const page = Math.min(Math.max(1, pageNumber), pageCount);
    const from = locateCenter()?.page ?? 1;
    const behavior: ScrollBehavior = Math.abs(page - from) <= 1 ? 'smooth' : 'auto';
    navigationRef.current = { page, toRegion: alignToRegion, at: performance.now(), aligned: false };
    lastReportedPageRef.current = null;
    const frame = requestAnimationFrame(() => scrollToTarget(page, alignToRegion, behavior));
    return () => cancelAnimationFrame(frame);
  }, [pageCount, pageNumber, navigationSeq, alignToRegion, locateCenter, scrollToTarget]);

  // Once the target page is drawn, align the region again (no-op when it is already in place).
  const handleRendered = useCallback(
    (page: number) => {
      const navigation = navigationRef.current;
      if (!navigation || navigation.aligned || navigation.page !== page) return;
      if (performance.now() - navigation.at > NAVIGATION_SETTLE_MS) return;
      navigation.aligned = true;
      scrollToTarget(page, navigation.toRegion, 'smooth');
    },
    [scrollToTarget]
  );

  // Zoom / fit-to-width: keep the point under the container centre where it was (otherwise the
  // same scrollTop would land on another page). Right after a navigation, re-align its target.
  const previousScaleRef = useRef(scale);
  useLayoutEffect(() => {
    if (previousScaleRef.current === scale) return;
    previousScaleRef.current = scale;
    const navigation = navigationRef.current;
    if (navigation && performance.now() - navigation.at < NAVIGATION_SETTLE_MS) {
      scrollToTarget(navigation.page, navigation.toRegion, 'auto');
      return;
    }
    const container = scrollContainerRef.current;
    const anchor = anchorRef.current;
    const element = anchor ? pageElementsRef.current.get(anchor.page) : undefined;
    if (!container || !anchor || !element) return;
    const rect = element.getBoundingClientRect();
    const center = container.getBoundingClientRect().top + container.clientHeight / 2;
    container.scrollTop += rect.top + anchor.fraction * rect.height - center;
  }, [scale, scrollToTarget, scrollContainerRef]);

  if (!sizes) {
    return sizesState.status === 'error' ? null : <RenderingMessage />;
  }

  return (
    <div className="mx-auto my-auto flex shrink-0 flex-col gap-4" data-testid="pdf-pages">
      {sizes.map((size, index) => (
        <PdfPageSlot
          key={index + 1}
          pdf={pdf}
          pageNumber={index + 1}
          size={size}
          scale={scale}
          shouldRender={!observerSupported || pagesInRange.has(index + 1)}
          citations={citations}
          activeCitation={activeCitation}
          onSelectCitation={onSelectCitation}
          registerElement={registerElement}
          onRendered={handleRendered}
        />
      ))}
    </div>
  );
}
