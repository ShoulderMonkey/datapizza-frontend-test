'use client';

import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { documentService, getUserMessage } from '@/src/api';
import { queryKeys } from '../../queryKeys';
import type { AsyncStatus } from '../types';

const UPLOAD_FALLBACK_MESSAGE = 'Non è stato possibile caricare i documenti. Controlla i file e riprova.';

/** Upload of PDFs (POST /api/documents/, multipart field `files`). */
export function useDocumentUpload() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AsyncStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
    setSuccessMessage(null);
  }, []);

  /** Returns true on success. */
  const upload = useCallback(async (files: File[]): Promise<boolean> => {
    setStatus('loading');
    setError(null);
    setSuccessMessage(null);
    try {
      await documentService.uploadDocuments(files);
      await queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
      setSuccessMessage(`${files.length} documento/i caricato/i con successo!`);
      setStatus('success');
      return true;
    } catch (err: unknown) {
      console.error('Document upload error:', err);
      setError(getUserMessage(err, UPLOAD_FALLBACK_MESSAGE));
      setStatus('error');
      return false;
    }
  }, [queryClient]);

  return {
    status,
    isUploading: status === 'loading',
    error,
    setError,
    successMessage,
    setSuccessMessage,
    reset,
    upload,
  };
}
