'use client';

import React, { useRef, useState } from 'react';
import { UploadCloud, File, X, AlertTriangle, CheckCircle } from 'lucide-react';
import { isPdfFile } from '@/src/api';
import { useDocumentUpload } from '../hooks/useDocumentUpload';

interface DocumentUploadDropzoneProps {
  onUploadSuccess: () => void;
}

export function DocumentUploadDropzone({ onUploadSuccess }: DocumentUploadDropzoneProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const { isUploading, error, setError, successMessage, setSuccessMessage, upload, cancel } = useDocumentUpload();

  const handleFilesChosen = (incomingFiles: FileList | null) => {
    if (!incomingFiles || incomingFiles.length === 0) return;
    setError(null);
    setSuccessMessage(null);

    const validPdfs: File[] = [];
    const invalidFiles: string[] = [];

    Array.from(incomingFiles).forEach((f) => {
      if (isPdfFile(f)) {
        validPdfs.push(f);
      } else {
        invalidFiles.push(f.name);
      }
    });

    if (invalidFiles.length > 0) {
      setError(`File non accettati: ${invalidFiles.join(', ')}. Sono ammessi esclusivamente documenti PDF.`);
    }

    if (validPdfs.length > 0) {
      setSelectedFiles((prev) => [...prev, ...validPdfs]);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    if (selectedFiles.length <= 1) {
      setError(null);
    }
  };

  const clearAllFiles = () => {
    setSelectedFiles([]);
    setError(null);
    setSuccessMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      setError('Seleziona almeno un documento PDF prima di procedere.');
      return;
    }

    const ok = await upload(selectedFiles);
    if (ok) {
      setSelectedFiles([]);
      onUploadSuccess();
    }
  };

  return (
    <div className="space-y-4">
      {/* Drop area */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFilesChosen(e.dataTransfer.files);
        }}
        // Keyboard: the drop area is a button (Enter / Space open the file picker).
        role="button"
        tabIndex={0}
        aria-label="Scegli i documenti PDF da caricare"
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all focus-visible:outline-2 focus-visible:outline-indigo-600 ${
          isDragging
            ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 scale-[1.01]'
            : 'border-slate-300 dark:border-slate-600 hover:border-indigo-400 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-900'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          multiple
          className="hidden"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => handleFilesChosen(e.target.files)}
        />
        <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 flex items-center justify-center mx-auto mb-3">
          <UploadCloud className="w-6 h-6" />
        </div>
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Trascina qui i tuoi documenti PDF o <span className="text-indigo-600 dark:text-indigo-300 underline">sfoglia</span>
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Supporta uno o più file PDF (multipart/form-data, campo <code className="text-xs bg-slate-200 dark:bg-slate-700 px-1 rounded">files</code>)
        </p>
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2.5 text-xs text-red-700 dark:text-red-300 animate-in fade-in duration-150">
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-500 dark:text-red-400 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold">Errore caricamento: </span>
            {error}
          </div>
        </div>
      )}

      {/* Success alert */}
      {successMessage && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300 animate-in fade-in duration-150">
          <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Selected files preview */}
      {selectedFiles.length > 0 && (
        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 pb-1.5">
            <span>File selezionati ({selectedFiles.length})</span>
            <button
              type="button"
              onClick={clearAllFiles}
              className="text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 cursor-pointer text-xs"
            >
              Rimuovi tutti
            </button>
          </div>

          <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
            {selectedFiles.map((file, idx) => (
              <div
                key={`file-${idx}-${file.name}`}
                className="flex items-center justify-between p-2 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <File className="w-4 h-4 text-indigo-500 dark:text-indigo-400 shrink-0" />
                  <span className="truncate font-medium text-slate-800 dark:text-slate-100" title={file.name}>
                    {file.name}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 shrink-0 text-[11px]">
                    ({(file.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(idx)}
                  className="text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 p-0.5 rounded cursor-pointer"
                  title="Rimuovi"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="pt-2 flex justify-end items-center gap-2">
            {isUploading && (
              <button
                type="button"
                onClick={cancel}
                className="px-3 py-2 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Annulla
              </button>
            )}
            <button
              type="button"
              onClick={handleUpload}
              disabled={isUploading}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
            >
              {isUploading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Caricamento in corso...</span>
                </>
              ) : (
                <span>Carica {selectedFiles.length} file</span>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
