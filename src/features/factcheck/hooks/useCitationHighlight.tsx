'use client';

import React, { createContext, useContext, useMemo, useState } from 'react';
import type { CitationReference } from '../types';

interface CitationHighlightValue {
  /** Citation hovered/focused in a card: its bounding boxes in the PDF are highlighted. */
  highlighted: CitationReference | null;
  setHighlighted: (citation: CitationReference | null) => void;
}

const NOOP: CitationHighlightValue = { highlighted: null, setHighlighted: () => undefined };

const CitationHighlightContext = createContext<CitationHighlightValue>(NOOP);

/**
 * Transient "highlighted" citation (card hover/focus -> PDF boxes). It is separate from the
 * "active" citation (selected by click), which lives in `usePdfViewer`. Local context of the
 * feature: no global store. Without a provider it is a no-op.
 */
export function CitationHighlightProvider({ children }: { children: React.ReactNode }) {
  const [highlighted, setHighlighted] = useState<CitationReference | null>(null);
  const value = useMemo(() => ({ highlighted, setHighlighted }), [highlighted]);
  return <CitationHighlightContext.Provider value={value}>{children}</CitationHighlightContext.Provider>;
}

export function useCitationHighlight(): CitationHighlightValue {
  return useContext(CitationHighlightContext);
}
