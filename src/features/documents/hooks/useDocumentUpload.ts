'use client';

import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { documentService, logError, toUserMessage } from '@/src/api';
import { queryKeys } from '../../queryKeys';
import type { AsyncStatus } from '../types';


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
      logError('Document upload error:', err);
      setError(toUserMessage(err, 'upload'));
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
