'use client';

import React from 'react';
import type { CitationReference } from '../types';
import { inchesRectToPx } from '../lib/coordinates';

interface BoundingBoxOverlayProps {
  pageNumber: number;
  pageWidthPt: number;
  /** Width of the rendered page in CSS px (page width in pt x zoom scale). */
  renderedWidthPx: number;
  citations: CitationReference[];
  activeCitation?: CitationReference | null;
  onSelectCitation?: (citation: CitationReference) => void;
}

export function BoundingBoxOverlay({
  pageNumber,
  pageWidthPt,
  renderedWidthPx,
  citations,
  activeCitation,
  onSelectCitation,
}: BoundingBoxOverlayProps) {
  // Collect all bounding regions for this specific page
  const pageRegions = React.useMemo(() => {
    const list: Array<{
      citation: CitationReference;
      isActive: boolean;
      rectIndex: number;
      rectInches: [number, number, number, number];
    }> = [];

    citations.forEach((cit) => {
      const isTargetCitation =
        activeCitation &&
        activeCitation.document_id === cit.document_id &&
        activeCitation.page_number === cit.page_number &&
        activeCitation.text_quote === cit.text_quote;

      if (!cit.bounding_regions || cit.bounding_regions.length === 0) {
        return;
      }

      cit.bounding_regions.forEach((region) => {
        if (region.page_number === pageNumber && Array.isArray(region.rects_in)) {
          region.rects_in.forEach((rect, idx) => {
            if (Array.isArray(rect) && rect.length >= 4) {
              list.push({
                citation: cit,
                isActive: Boolean(isTargetCitation),
                rectIndex: idx,
                rectInches: rect,
              });
            }
          });
        }
      });
    });

    return list;
  }, [citations, activeCitation, pageNumber]);

  if (pageRegions.length === 0) {
    return null;
  }

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden select-none"
      data-testid="bounding-box-overlay"
    >
      {pageRegions.map((item, index) => {
        const px = inchesRectToPx(item.rectInches, pageWidthPt, renderedWidthPx);

        return (
          <button
            type="button"
            tabIndex={-1}
            key={`bbox-${pageNumber}-${index}`}
            aria-label={`Citazione ${index + 1}`}
            aria-current={item.isActive ? 'true' : undefined}
            style={{
              left: px.left,
              top: px.top,
              width: px.width,
              height: px.height,
            }}
            data-testid="bbox"
            data-active={item.isActive ? 'true' : 'false'}
            onClick={(e) => {
              e.stopPropagation();
              onSelectCitation?.(item.citation);
            }}
            className={`absolute pointer-events-auto cursor-pointer rounded-xs transition-all duration-200 group ${
              item.isActive
                ? 'border-2 border-amber-500 bg-amber-400/30 ring-4 ring-amber-400/25 shadow-lg shadow-amber-500/20 z-20'
                : 'border-2 border-indigo-500/80 bg-indigo-400/20 hover:border-indigo-600 hover:bg-indigo-400/35 z-10'
            }`}
            title={`Citazione #${index + 1}: "${item.citation.text_quote.slice(0, 80)}..."`}
          >
            {/* Corner Badge */}
            <span
              className={`absolute -top-3 -left-1 px-1.5 py-0.2 text-[10px] font-bold rounded shadow-xs pointer-events-none transition-transform group-hover:scale-110 ${
                item.isActive
                  ? 'bg-amber-600 text-white ring-1 ring-amber-700'
                  : 'bg-indigo-600 text-white'
              }`}
            >
              #{index + 1}
            </span>

            {/* Tooltip on hover */}
            <span className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 max-w-xs p-2 bg-slate-900/95 text-white text-xs rounded-md shadow-xl z-50 pointer-events-none backdrop-blur-xs border border-slate-700">
              <span className="block font-semibold text-amber-300 text-[11px] mb-0.5">
                Regione di citazione ({item.rectInches[0].toFixed(2)}&quot; × {item.rectInches[1].toFixed(2)}&quot;)
              </span>
              <span className="block italic text-slate-200 line-clamp-3 leading-snug">
                &ldquo;{item.citation.text_quote}&rdquo;
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
