'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { CitationReference } from '../types';
import { isSameCitation } from '../lib/citations';
import { useCitationHighlight } from '../hooks/useCitationHighlight';
import { FileText, ChevronDown, ChevronUp, ExternalLink, Bookmark } from 'lucide-react';

interface RelatedDocumentsSectionProps {
  citations: CitationReference[];
  onInspectCitation: (citation: CitationReference) => void;
  /** Citation currently shown in the PDF panel: its card is highlighted. */
  activeCitation?: CitationReference | null;
}

export function RelatedDocumentsSection({
  citations,
  onInspectCitation,
  activeCitation,
}: RelatedDocumentsSectionProps) {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const { setHighlighted } = useCitationHighlight();
  const activeCardRef = useRef<HTMLButtonElement | null>(null);
  const hasActiveCard = citations.some((c) => isSameCitation(activeCitation, c));

  // The active card (e.g. selected by clicking a box in the PDF) becomes visible. `nearest`
  // does not move it if already visible; focus is never moved. jsdom has no scrollIntoView.
  useEffect(() => {
    if (hasActiveCard && isExpanded) {
      activeCardRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'auto' });
    }
  }, [activeCitation, hasActiveCard, isExpanded]);

  if (!citations || citations.length === 0) {
    return null;
  }

  // Count total bounding boxes
  const totalBoxes = citations.reduce((total, cit) => {
    return (
      total +
      (cit.bounding_regions?.reduce((rTotal, r) => rTotal + (r.rects_in?.length || 0), 0) || 0)
    );
  }, 0);

  return (
    <div className="mt-4 pt-3 border-t border-slate-200/80">
      {/* Collapsible Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-left text-xs font-semibold text-slate-700 hover:text-indigo-600 transition-colors py-1 cursor-pointer group"
      >
        <div className="flex items-center gap-2">
          <Bookmark className="w-3.5 h-3.5 text-indigo-600 group-hover:scale-110 transition-transform" />
          <span className="tracking-wide uppercase text-[11px] text-slate-600 font-bold">
            Documenti correlati ({citations.length})
          </span>
          {totalBoxes > 0 && (
            <span className="text-[10px] font-normal px-1.5 py-0.2 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              {totalBoxes} {totalBoxes === 1 ? 'regione' : 'regioni'} evidenziate
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-slate-400 group-hover:text-slate-600">
          <span className="text-[11px] font-normal">{isExpanded ? 'Comprimi' : 'Espandi'}</span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </div>
      </button>

      {/* Citations Grid / Cards */}
      {isExpanded && (
        <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5 animate-in fade-in duration-150">
          {citations.map((citation, index) => {
            const rectCount =
              citation.bounding_regions?.reduce(
                (acc, r) => acc + (r.rects_in?.length || 0),
                0
              ) || 0;

            const isActive = isSameCitation(activeCitation, citation);

            return (
              <button
                type="button"
                key={`citation-card-${index}`}
                ref={isActive ? activeCardRef : undefined}
                data-testid="citation-card"
                onMouseEnter={() => setHighlighted(citation)}
                onMouseLeave={() => setHighlighted(null)}
                onFocus={() => setHighlighted(citation)}
                onBlur={() => setHighlighted(null)}
                onClick={() => onInspectCitation(citation)}
                aria-current={isActive ? 'true' : undefined}
                className={`group relative flex flex-col justify-between p-3 border rounded-lg transition-all cursor-pointer text-left ${
                  isActive
                    ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-400/40 shadow-xs'
                    : 'bg-white/90 hover:bg-indigo-50/40 border-slate-200 hover:border-indigo-300 shadow-2xs hover:shadow-xs'
                }`}
              >
                <span className="block w-full">
                  <span className="flex items-center justify-between gap-1 mb-1.5">
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-900 truncate">
                      <FileText className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      <span className="truncate max-w-[140px] font-semibold" title={citation.filename}>
                        {citation.filename}
                      </span>
                    </span>
                    <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                      Pag. {citation.page_number}
                    </span>
                  </span>

                  <span className="block text-[12px] text-slate-600 italic line-clamp-3 leading-snug bg-slate-50/80 p-2 rounded border border-slate-100">
                    &ldquo;{citation.text_quote}&rdquo;
                  </span>
                </span>

                <span className="mt-2.5 pt-2 border-t border-slate-100 flex w-full items-center justify-between text-[11px]">
                  <span className="text-slate-400">
                    {rectCount > 0 ? `${rectCount} box verificati` : 'Riferimento'}
                  </span>
                  <span className="inline-flex items-center gap-1 font-medium text-indigo-600 group-hover:text-indigo-700 group-hover:translate-x-0.5 transition-transform">
                    <span>Verifica nel PDF</span>
                    <ExternalLink className="w-3 h-3" />
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
