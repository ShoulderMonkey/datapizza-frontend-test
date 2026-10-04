'use client';

import React, { useState } from 'react';
import { getApiBaseUrl, setApiBaseUrl, resetApiBaseUrl, DEFAULT_API_BASE_URL } from '@/config/api';
import {
  Server,
  X,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ShieldCheck,
  Zap,
} from 'lucide-react';

interface BackendConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigChanged?: () => void;
}

export function BackendConfigModal({
  isOpen,
  onClose,
  onConfigChanged,
}: BackendConfigModalProps) {
  const [url, setUrl] = useState<string>(() => getApiBaseUrl());
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testResult, setTestResult] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSave = () => {
    setApiBaseUrl(url);
    onConfigChanged?.();
    onClose();
  };

  const handleReset = () => {
    setUrl(DEFAULT_API_BASE_URL);
    resetApiBaseUrl();
    onConfigChanged?.();
  };

  const testConnection = async () => {
    setTestStatus('testing');
    setTestResult(null);
    const targetUrl = url.trim().replace(/\/+$/, '');

    try {
      const startTime = performance.now();
      // Test GET /api/documents/ endpoint
      const response = await fetch(`${targetUrl}/api/documents/`, {
        method: 'GET',
        credentials: 'include',
      });

      const elapsed = Math.round(performance.now() - startTime);

      if (response.ok || response.status === 401) {
        setTestStatus('success');
        setTestResult(
          `Connessione riuscita! HTTP ${response.status} (${response.statusText || 'OK'}), latenza: ${elapsed}ms.`
        );
      } else {
        setTestStatus('error');
        setTestResult(
          `Il server ha risposto con codice ${response.status} (${response.statusText}). Verifica endpoint e credenziali.`
        );
      }
    } catch (err: unknown) {
      console.warn('Connection test failed:', err);
      setTestStatus('error');
      setTestResult(
        `Impossibile contattare ${targetUrl}. Possibili cause:\n• Il server backend FastAPI non è in esecuzione;\n• Errore CORS (FastAPI deve includere CORSMiddleware con allow_credentials=True);\n• Host non raggiungibile.`
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Configurazione Backend API</h2>
              <p className="text-xs text-slate-500">
                Imposta l&apos;endpoint REST del server FastAPI
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            aria-label="Chiudi"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-xs text-slate-600">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              API Base URL
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="http://localhost:8000"
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
              />
              <button
                type="button"
                onClick={testConnection}
                disabled={testStatus === 'testing' || !url.trim()}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-800 rounded-lg font-medium transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                {testStatus === 'testing' ? (
                  <div className="w-3.5 h-3.5 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Zap className="w-3.5 h-3.5 text-indigo-600" />
                )}
                <span>Verifica</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Valore predefinito: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-600">{DEFAULT_API_BASE_URL}</code>
            </p>
          </div>

          {/* Test results */}
          {testStatus === 'success' && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 flex items-start gap-2 animate-in fade-in duration-150">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-xs whitespace-pre-wrap">{testResult}</div>
            </div>
          )}

          {testStatus === 'error' && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 flex items-start gap-2 animate-in fade-in duration-150">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs whitespace-pre-wrap">{testResult}</div>
            </div>
          )}

          {/* Guidance box */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-[12px]">
            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <span>Integrazione REST nativa con credenziali Cookie</span>
            </div>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              Tutte le richieste includono <code className="bg-white px-1 py-0.5 border rounded font-mono">credentials: &apos;include&apos;</code> per gestire il cookie di autenticazione <code className="bg-white px-1 py-0.5 border rounded font-mono">user_id</code>.
            </p>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              In caso di testing locale con browser e origini differenti, assicurati che FastAPI abbia:
            </p>
            <pre className="bg-slate-900 text-slate-200 p-2 rounded text-[10px] font-mono overflow-x-auto">
{`app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)`}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={handleReset}
            className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Ripristina default</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-medium cursor-pointer"
            >
              Annulla
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer transition-colors"
            >
              Salva impostazioni
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
