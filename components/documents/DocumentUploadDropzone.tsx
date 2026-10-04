'use client';

import React, { useRef, useState } from 'react';
import { UploadCloud, File, X, AlertTriangle, CheckCircle } from 'lucide-react';
import { documentService } from '@/services/document-service';

interface DocumentUploadDropzoneProps {
  onUploadSuccess: () => void;
}

export function DocumentUploadDropzone({ onUploadSuccess }: DocumentUploadDropzoneProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleFilesChosen = (incomingFiles: FileList | null) => {
    if (!incomingFiles || incomingFiles.length === 0) return;
    setError(null);
    setSuccessMessage(null);

    const validPdfs: File[] = [];
    const invalidFiles: string[] = [];

    Array.from(incomingFiles).forEach((f) => {
      if (f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')) {
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

    setIsUploading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await documentService.uploadDocuments(selectedFiles);
      setSuccessMessage(`${selectedFiles.length} documento/i caricato/i con successo!`);
      setSelectedFiles([]);
      onUploadSuccess();
    } catch (err: unknown) {
      console.error('Document upload error:', err);
      const msg = (err as Error)?.message || 'Non è stato possibile caricare i documenti. Controlla i file e riprova.';
      setError(msg);
    } finally {
      setIsUploading(false);
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
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-indigo-600 bg-indigo-50/50 scale-[1.01]'
            : 'border-slate-300 hover:border-indigo-400 bg-slate-50/50 hover:bg-slate-50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => handleFilesChosen(e.target.files)}
        />
        <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-3">
          <UploadCloud className="w-6 h-6" />
        </div>
        <p className="text-sm font-semibold text-slate-800">
          Trascina qui i tuoi documenti PDF o <span className="text-indigo-600 underline">sfoglia</span>
        </p>
        <p className="text-xs text-slate-500 mt-1">
          Supporta uno o più file PDF (multipart/form-data, campo <code className="text-xs bg-slate-200 px-1 rounded">files</code>)
        </p>
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-xs text-red-700 animate-in fade-in duration-150">
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold">Errore caricamento: </span>
            {error}
          </div>
        </div>
      )}

      {/* Success alert */}
      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-xs text-emerald-800 animate-in fade-in duration-150">
          <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Selected files preview */}
      {selectedFiles.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700 border-b border-slate-200 pb-1.5">
            <span>File selezionati ({selectedFiles.length})</span>
            <button
              type="button"
              onClick={clearAllFiles}
              className="text-slate-400 hover:text-red-600 cursor-pointer text-xs"
            >
              Rimuovi tutti
            </button>
          </div>

          <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
            {selectedFiles.map((file, idx) => (
              <div
                key={`file-${idx}-${file.name}`}
                className="flex items-center justify-between p-2 bg-white rounded border border-slate-200 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <File className="w-4 h-4 text-indigo-500 shrink-0" />
                  <span className="truncate font-medium text-slate-800" title={file.name}>
                    {file.name}
                  </span>
                  <span className="text-slate-400 shrink-0 text-[11px]">
                    ({(file.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(idx)}
                  className="text-slate-400 hover:text-red-500 p-0.5 rounded cursor-pointer"
                  title="Rimuovi"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="pt-2 flex justify-end">
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
