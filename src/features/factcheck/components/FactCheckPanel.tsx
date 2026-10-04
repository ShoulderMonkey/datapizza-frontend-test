'use client';

import React, { useEffect, useRef } from 'react';
import { useIsDesktop } from '../hooks/useIsDesktop';
import type { CitationReference, PdfViewerTarget } from '../types';
import { PdfFactCheckViewer } from './PdfFactCheckViewer';

interface FactCheckPanelProps {
  target: PdfViewerTarget;
  onClose: () => void;
  onSelectCitation: (citation: CitationReference) => void;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Container of the PDF viewer. At >= 1024 px it is a side panel (`complementary`) next to the
 * conversation, which stays visible and usable. Below it is a full-screen modal drawer
 * (`dialog`, focus trapped). Focus moves to the panel on open; `Escape` closes it and focus
 * returns to the element (citation card) that last had focus outside the panel.
 */
export function FactCheckPanel({ target, onClose, onSelectCitation }: FactCheckPanelProps) {
  const isDesktop = useIsDesktop();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    let returnTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.focus();

    // Remember the last element focused outside the panel (the card that opened/changed it).
    const onFocusIn = (e: FocusEvent) => {
      if (e.target instanceof HTMLElement && !panel.contains(e.target)) returnTo = e.target;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        onCloseRef.current();
      }
    };
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('keydown', onKeyDown);
      if (returnTo && returnTo.isConnected) returnTo.focus();
    };
  }, []);

  // Modal mode only: keep Tab inside the dialog.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (isDesktop || e.key !== 'Tab' || !panelRef.current) return;
    const items = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === panelRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const modeProps = isDesktop
    ? { role: 'complementary' }
    : { role: 'dialog', 'aria-modal': true as const };

  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      aria-label="Verifica fonti"
      onKeyDown={handleKeyDown}
      data-mode={isDesktop ? 'panel' : 'drawer'}
      className={
        isDesktop
          ? 'h-full w-[46%] max-w-3xl shrink-0 border-l border-slate-800 bg-slate-950 outline-none'
          : 'fixed inset-0 z-50 bg-slate-950 outline-none'
      }
      {...modeProps}
    >
      <PdfFactCheckViewer
        documentId={target.documentId}
        filename={target.filename}
        initialPage={target.pageNumber}
        citations={target.allCitations}
        activeCitation={target.citation}
        onClose={onClose}
        onSelectCitation={onSelectCitation}
      />
    </div>
  );
}
