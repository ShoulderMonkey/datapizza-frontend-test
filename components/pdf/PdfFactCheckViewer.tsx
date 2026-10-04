'use client';

import React, { useEffect, useRef, useState } from 'react';
import { CitationReference } from '@/types/citation';
import { documentService } from '@/services/document-service';
import { BoundingBoxOverlay } from './BoundingBoxOverlay';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  AlertTriangle,
  FileText,
  X,
  ExternalLink,
  Sliders,
  List,
} from 'lucide-react';

interface PdfFactCheckViewerProps {
  documentId: string;
  filename: string;
  initialPage?: number;
  citations?: CitationReference[];
  activeCitation?: CitationReference | null;
  onClose: () => void;
  onSelectCitation?: (citation: CitationReference) => void;
}

export function PdfFactCheckViewer({
  documentId,
  filename,
  initialPage = 1,
  citations = [],
  activeCitation,
  onClose,
  onSelectCitation,
}: PdfFactCheckViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // PDF Document & Page state
  const [pdfDoc, setPdfDoc] = useState<unknown | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(initialPage);
  const [pageWidthPt, setPageWidthPt] = useState<number>(612); // default 8.5" * 72
  const [pageHeightPt, setPageHeightPt] = useState<number>(792); // default 11" * 72
  const [pageDimensionsPx, setPageDimensionsPx] = useState<{ width: number; height: number }>({
    width: 612,
    height: 792,
  });

  // Controls & Display state
  const [scale, setScale] = useState<number>(1.2);
  const [origin, setOrigin] = useState<'top-left' | 'bottom-left'>('top-left');
  const [showCitationList, setShowCitationList] = useState<boolean>(true);
  const [showSettings, setShowSettings] = useState<boolean>(false);

  // Async loading & error state
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadingMessage, setLoadingMessage] = useState<string>('Caricamento del documento...');
  const [error, setError] = useState<string | null>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);

  // Sync initial page if prop changes using standard React render-time adjustment
  const [prevInitialPage, setPrevInitialPage] = useState<number>(initialPage);
  if (initialPage !== prevInitialPage) {
    setPrevInitialPage(initialPage);
    setCurrentPage(initialPage);
  }

  // Load PDF binary
  useEffect(() => {
    let isCancelled = false;
    let createdUrl: string | null = null;

    async function loadPdf() {
      setIsLoading(true);
      setError(null);
      setLoadingMessage(`Download di "${filename}"...`);

      try {
        const blob = await documentService.getDocumentFile(documentId);
        if (isCancelled) return;

        createdUrl = URL.createObjectURL(blob);
        setPdfBlobUrl(createdUrl);
        const arrayBuffer = await blob.arrayBuffer();
        if (isCancelled) return;

        setLoadingMessage('Inizializzazione motore PDF.js...');
        const pdfjsLib = await import('pdfjs-dist');

        // Configure worker
        if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
        }

        const loadingTask = pdfjsLib.getDocument({
          data: new Uint8Array(arrayBuffer),
          cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',
          cMapPacked: true,
        });

        const doc = await loadingTask.promise;
        if (isCancelled) return;

        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setIsLoading(false);
      } catch (err: unknown) {
        if (isCancelled) return;
        console.error('Failed to load PDF in fact-check viewer:', err);
        const msg = (err as Error)?.message || 'Impossibile caricare il file PDF dal server.';
        setError(msg);
        setIsLoading(false);
      }
    }

    loadPdf();

    return () => {
      isCancelled = true;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [documentId, filename]);

  // Render Page onto Canvas inside effect with cancellation tracking
  useEffect(() => {
    if (!pdfDoc || currentPage <= 0 || numPages <= 0) return;
    let isCancelled = false;

    async function drawPage() {
      if (!canvasRef.current) return;

      try {
        const doc = pdfDoc as {
          getPage: (n: number) => Promise<{
            getViewport: (opts: { scale: number }) => { width: number; height: number };
            render: (ctx: unknown) => { promise: Promise<void> };
          }>;
        };
        const page = await doc.getPage(currentPage);
        if (isCancelled) return;

        // Get unscaled viewport to determine original page points (DPI 72)
        const unscaledViewport = page.getViewport({ scale: 1 });
        setPageWidthPt(unscaledViewport.width);
        setPageHeightPt(unscaledViewport.height);

        // Render viewport with user zoom scale
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext('2d');
        if (!context) return;

        const outputScale = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        setPageDimensionsPx({
          width: Math.floor(viewport.width),
          height: Math.floor(viewport.height),
        });

        const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
          transform: transform,
        };

        await page.render(renderContext).promise;
      } catch (err) {
        if (!isCancelled) {
          console.warn('Page render was interrupted or failed:', err);
        }
      }
    }

    drawPage();

    return () => {
      isCancelled = true;
    };
  }, [pdfDoc, currentPage, scale, numPages]);

  // Navigation handlers
  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < numPages) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  const handleZoomIn = () => setScale((s) => Math.min(3.0, +(s + 0.2).toFixed(1)));
  const handleZoomOut = () => setScale((s) => Math.max(0.6, +(s - 0.2).toFixed(1)));
  const handleResetZoom = () => setScale(1.2);
  const handleFitWidth = () => {
    if (containerRef.current && pageWidthPt > 0) {
      const containerWidth = containerRef.current.clientWidth - 48; // padding
      const computedScale = Math.max(0.6, Math.min(2.5, containerWidth / pageWidthPt));
      setScale(+computedScale.toFixed(2));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 text-white select-none">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-1.5 rounded-md bg-indigo-600/30 text-indigo-400 border border-indigo-500/30">
            <FileText className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold truncate text-slate-100 flex items-center gap-2">
              <span>{filename}</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                Fact-Checking Viewer
              </span>
            </h2>
            <p className="text-xs text-slate-400 truncate">
              ID Documento: <span className="font-mono">{documentId}</span>
            </p>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Page Navigation */}
          {numPages > 0 && (
            <div className="flex items-center bg-slate-800/90 border border-slate-700 rounded-lg px-1.5 py-1 text-xs">
              <button
                onClick={handlePrevPage}
                disabled={currentPage <= 1}
                aria-label="Pagina precedente"
                className="p-1 rounded hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-colors"
                title="Pagina precedente"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="px-2 font-mono flex items-center gap-1">
                <input
                  type="number"
                  min={1}
                  max={numPages}
                  value={currentPage}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val) && val >= 1 && val <= numPages) {
                      setCurrentPage(val);
                    }
                  }}
                  className="w-10 text-center bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-xs text-white"
                />
                <span className="text-slate-400">/ {numPages}</span>
              </div>
              <button
                onClick={handleNextPage}
                disabled={currentPage >= numPages}
                aria-label="Pagina successiva"
                className="p-1 rounded hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-colors"
                title="Pagina successiva"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Zoom Controls */}
          <div className="hidden md:flex items-center bg-slate-800/90 border border-slate-700 rounded-lg px-1.5 py-1 text-xs">
            <button
              onClick={handleZoomOut}
              className="p-1 rounded hover:bg-slate-700 cursor-pointer transition-colors"
              title="Riduci zoom (-)"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="px-2 font-mono text-[11px] text-slate-300">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              className="p-1 rounded hover:bg-slate-700 cursor-pointer transition-colors"
              title="Aumenta zoom (+)"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={handleResetZoom}
              className="p-1 ml-1 rounded hover:bg-slate-700 cursor-pointer transition-colors text-slate-400 hover:text-white"
              title="Ripristina 100%"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleFitWidth}
              className="p-1 rounded hover:bg-slate-700 cursor-pointer transition-colors text-slate-400 hover:text-white"
              title="Adatta alla larghezza"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Toggle Citation Drawer */}
          <button
            onClick={() => setShowCitationList(!showCitationList)}
            className={`p-1.5 rounded-lg border text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
              showCitationList
                ? 'bg-indigo-600 border-indigo-500 text-white'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
            title="Mostra / Nascondi citazioni"
          >
            <List className="w-4 h-4" />
            <span className="hidden sm:inline">Citazioni ({citations.length})</span>
          </button>

          {/* Settings / Origin toggle */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
              showSettings
                ? 'bg-slate-700 border-slate-600 text-white'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
            title="Impostazioni visualizzazione coordinate"
          >
            <Sliders className="w-4 h-4" />
          </button>

          {/* Raw PDF link */}
          {pdfBlobUrl && (
            <a
              href={pdfBlobUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden lg:flex items-center gap-1 p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 text-xs transition-colors"
              title="Apri PDF nativo in nuova scheda"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}

          {/* Close Button */}
          <button
            onClick={onClose}
            aria-label="Chiudi visualizzatore"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-950/60 hover:text-red-400 border border-slate-700 text-slate-300 transition-colors cursor-pointer ml-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Coordinate Settings Dropdown */}
      {showSettings && (
        <div className="bg-slate-900 border-b border-slate-800 px-6 py-2.5 text-xs text-slate-300 flex flex-wrap items-center gap-4 animate-in slide-in-from-top-1 duration-150">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-400">Origine coordinate bounding box:</span>
            <select
              value={origin}
              onChange={(e) => setOrigin(e.target.value as 'top-left' | 'bottom-left')}
              className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white text-xs cursor-pointer"
            >
              <option value="top-left">In alto a sinistra (Top-Left, standard OCR/Azure)</option>
              <option value="bottom-left">In basso a sinistra (Bottom-Left, standard PDF nativo)</option>
            </select>
          </div>
          <div className="text-slate-400">
            DPI: <span className="font-mono text-slate-200">72 pt/pollice</span> • Dimensioni pagina: {pageWidthPt.toFixed(0)} × {pageHeightPt.toFixed(0)} pt ({(pageWidthPt / 72).toFixed(1)}&quot; × {(pageHeightPt / 72).toFixed(1)}&quot;)
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* PDF Canvas Viewport Container */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto bg-slate-950 flex items-start justify-center p-4 sm:p-6"
        >
          {isLoading && (
            <div className="m-auto text-center p-8 bg-slate-900/90 border border-slate-800 rounded-xl shadow-2xl max-w-sm">
              <div className="w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <h3 className="text-sm font-semibold text-slate-100 mb-1">{loadingMessage}</h3>
              <p className="text-xs text-slate-400">Connessione al backend e rendering vettoriale in corso...</p>
            </div>
          )}

          {error && (
            <div className="m-auto text-left p-6 bg-slate-900 border border-red-900/60 rounded-xl shadow-2xl max-w-lg text-slate-200">
              <div className="flex items-start gap-3 mb-3 text-red-400">
                <AlertTriangle className="w-6 h-6 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-base font-semibold text-white">Caricamento PDF non riuscito</h3>
                  <p className="text-xs text-red-300/90 mt-1">{error}</p>
                </div>
              </div>

              {/* Graceful Fallback Citation Inspection */}
              <div className="mt-4 pt-4 border-t border-slate-800">
                <h4 className="text-xs font-semibold text-amber-300 uppercase tracking-wider mb-2">
                  Metadati Citazioni disponibili (Fallback):
                </h4>
                {citations.length > 0 ? (
                  <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                    {citations.map((c, i) => (
                      <div key={i} className="p-3 bg-slate-800/80 rounded border border-slate-700 text-xs">
                        <div className="flex justify-between font-medium text-slate-300 mb-1">
                          <span>Pagina {c.page_number}</span>
                          <span className="text-slate-400">{c.filename}</span>
                        </div>
                        <p className="italic text-slate-200 bg-slate-900/60 p-2 rounded border border-slate-800">
                          &ldquo;{c.text_quote}&rdquo;
                        </p>
                        {c.bounding_regions && (
                          <div className="text-[11px] text-slate-400 mt-1.5 font-mono">
                            {c.bounding_regions.map((r, rIdx) => (
                              <div key={rIdx}>
                                Reg #{rIdx + 1}: {r.rects_in?.map((box) => `[${box.join(', ')}] pollici`).join(' | ')}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">Nessun metadato citazione associato a questo documento.</p>
                )}
              </div>
            </div>
          )}

          {!isLoading && !error && (
            <div
              className="relative shadow-2xl rounded bg-white transition-all duration-150 my-auto"
              style={{
                width: `${pageDimensionsPx.width}px`,
                height: `${pageDimensionsPx.height}px`,
              }}
            >
              {/* PDF Canvas */}
              <canvas ref={canvasRef} className="block rounded" />

              {/* Interactive Bounding Box Highlight Overlay */}
              <BoundingBoxOverlay
                pageNumber={currentPage}
                pageWidthPt={pageWidthPt}
                pageHeightPt={pageHeightPt}
                citations={citations}
                activeCitation={activeCitation}
                origin={origin}
                onSelectCitation={onSelectCitation}
              />
            </div>
          )}
        </div>

        {/* Side Panel: Associated Citations for this Document */}
        {showCitationList && (
          <div className="w-80 md:w-96 bg-slate-900 border-l border-slate-800 flex flex-col h-full text-slate-200 shrink-0">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                  Citazioni ({citations.length})
                </span>
                <span className="text-[11px] text-slate-400">
                  • Pagina corrente: {currentPage}
                </span>
              </div>
              <button
                onClick={() => setShowCitationList(false)}
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 cursor-pointer"
                title="Nascondi pannello"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {citations.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  Nessuna citazione correlata registrata per questo documento.
                </div>
              ) : (
                citations.map((citation, index) => {
                  const isCurrentPage = citation.page_number === currentPage;
                  const isSelected =
                    activeCitation &&
                    activeCitation.document_id === citation.document_id &&
                    activeCitation.page_number === citation.page_number &&
                    activeCitation.text_quote === citation.text_quote;

                  const rectCount =
                    citation.bounding_regions?.reduce(
                      (acc, r) => acc + (r.rects_in?.length || 0),
                      0
                    ) || 0;

                  return (
                    <div
                      key={`cit-list-${index}`}
                      onClick={() => {
                        setCurrentPage(citation.page_number);
                        onSelectCitation?.(citation);
                      }}
                      className={`p-3 rounded-lg border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-amber-950/40 border-amber-500/80 ring-2 ring-amber-500/20 shadow-md'
                          : isCurrentPage
                          ? 'bg-slate-800/90 border-indigo-500/50 hover:border-indigo-400'
                          : 'bg-slate-800/40 border-slate-700/60 hover:bg-slate-800/80 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span
                          className={`font-semibold px-2 py-0.5 rounded text-[11px] ${
                            isCurrentPage
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-700 text-slate-300'
                          }`}
                        >
                          Pagina {citation.page_number}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {rectCount} {rectCount === 1 ? 'box' : 'boxes'}
                        </span>
                      </div>

                      <blockquote className="text-xs text-slate-200 italic line-clamp-4 bg-slate-950/40 p-2 rounded border border-slate-800/80 leading-relaxed">
                        &ldquo;{citation.text_quote}&rdquo;
                      </blockquote>

                      <div className="mt-2 flex items-center justify-between text-[11px]">
                        <span className="text-slate-400 truncate max-w-[140px]">
                          {citation.filename}
                        </span>
                        <span
                          className={`font-medium underline hover:text-amber-300 ${
                            isCurrentPage ? 'text-amber-400' : 'text-indigo-400'
                          }`}
                        >
                          {isCurrentPage ? 'Evidenziato' : 'Vai a pagina'} →
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
