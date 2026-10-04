'use client';

import React, { useState } from 'react';
import { authService, validateUserId } from '@/services/auth-service';
import { getApiBaseUrl } from '@/config/api';
import {
  Lock,
  ArrowRight,
  AlertCircle,
  Sparkles,
  Server,
  FileCheck2,
} from 'lucide-react';

interface LoginFormProps {
  onLoginSuccess: (userId: string) => void;
  onOpenBackendConfig: () => void;
}

const PRESET_USERS = [
  { id: 'test_user', label: 'test_user (Default)' },
  { id: 'reviewer_lead', label: 'reviewer_lead' },
  { id: 'eval_candidate', label: 'eval_candidate' },
];

export function LoginForm({ onLoginSuccess, onOpenBackendConfig }: LoginFormProps) {
  const [userId, setUserId] = useState('test_user');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setValidationError(null);
    setServerError(null);

    const check = validateUserId(userId);
    if (!check.isValid) {
      setValidationError(check.error || 'User ID non valido.');
      return;
    }

    setIsLoading(true);

    try {
      await authService.login(userId.trim());
      onLoginSuccess(userId.trim());
    } catch (err: unknown) {
      console.error('Login failed:', err);
      const msg =
        (err as Error)?.message ||
        'Impossibile completare il login. Verifica la connessione al backend.';
      setServerError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectPreset = (presetId: string) => {
    setUserId(presetId);
    setValidationError(null);
    setServerError(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background ambient accents */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Branding & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex p-3 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-600/30 mb-4 ring-4 ring-indigo-500/20">
            <FileCheck2 className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">DocFact Assistant</h1>
          <p className="text-sm text-slate-400 mt-1.5 max-w-xs mx-auto">
            Chat grounded su PDF con streaming NDJSON e fact-checking visuale
          </p>
        </div>

        {/* Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 backdrop-blur-md">
          <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-800">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
              <Lock className="w-4 h-4 text-indigo-400" />
              <span>Autenticazione Sessione</span>
            </div>
            <button
              type="button"
              onClick={onOpenBackendConfig}
              className="text-[11px] text-slate-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer transition-colors"
              title="Configura URL backend"
            >
              <Server className="w-3.5 h-3.5" />
              <span className="font-mono truncate max-w-[120px]">{getApiBaseUrl()}</span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="user_id" className="block text-xs font-semibold text-slate-300 mb-1.5">
                User ID
              </label>
              <input
                id="user_id"
                type="text"
                value={userId}
                onChange={(e) => {
                  setUserId(e.target.value);
                  if (validationError) setValidationError(null);
                  if (serverError) setServerError(null);
                }}
                disabled={isLoading}
                placeholder="es. test_user"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all font-mono"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Caratteri ammessi: alfanumerici, trattino (<code className="text-slate-400">-</code>) e underscore (<code className="text-slate-400">_</code>).
              </p>
            </div>

            {/* Default presets */}
            <div>
              <span className="text-[11px] font-medium text-slate-400 block mb-1.5">
                Oppure seleziona un utente di test:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_USERS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset.id)}
                    className={`px-2.5 py-1 text-xs rounded-lg border transition-all cursor-pointer ${
                      userId === preset.id
                        ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300 font-medium'
                        : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Validation Error */}
            {validationError && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-start gap-2 animate-in fade-in duration-150">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                <span>{validationError}</span>
              </div>
            )}

            {/* Server Error */}
            {serverError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-300 flex items-start gap-2 animate-in fade-in duration-150">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-red-200">Errore durante il login</p>
                  <p className="mt-0.5 text-red-300/90">{serverError}</p>
                  <button
                    type="button"
                    onClick={onOpenBackendConfig}
                    className="mt-2 text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer font-medium"
                  >
                    <span>Verifica configurazione API backend</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !userId.trim()}
              className="w-full mt-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white font-semibold text-sm rounded-xl shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Accesso in corso...</span>
                </>
              ) : (
                <>
                  <span>Accedi all&apos;applicazione</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-800 text-center text-xs text-slate-500">
            La sessione utilizza un cookie HTTP sicuro <code className="text-slate-400 font-mono">user_id</code> gestito direttamente dal browser e inviato al backend.
          </div>
        </div>
      </div>
    </div>
  );
}
