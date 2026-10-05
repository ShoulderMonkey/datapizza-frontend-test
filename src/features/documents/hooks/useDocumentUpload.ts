'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { documentService, isAbortError, logError, toUserMessage } from '@/src/api';
import { queryKeys } from '../../queryKeys';
import type { AsyncStatus } from '../types';


/** Upload of PDFs (POST /api/documents/, multipart field `files`). */
export function useDocumentUpload() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AsyncStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const controllerRef = useRef<AbortController | null>(null);
  const unmountedRef = useRef(false);

  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      controllerRef.current?.abort();
    };
  }, []);

  /** Aborts the upload in progress (no-op when idle). */
  const cancel = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
    setSuccessMessage(null);
  }, []);

  /** Returns true on success. */
  const upload = useCallback(async (files: File[]): Promise<boolean> => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setStatus('loading');
    setError(null);
    setSuccessMessage(null);
    try {
      await documentService.uploadDocuments(files, controller.signal);
      if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      await queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
      setSuccessMessage(`${files.length} documento/i caricato/i con successo!`);
      setStatus('success');
      return true;
    } catch (err: unknown) {
      if (isAbortError(err)) {
        // Deliberate cancellation: not an error, nothing to show.
        if (!unmountedRef.current && controllerRef.current === controller) setStatus('idle');
        return false;
      }
      logError('Document upload error:', err);
      setError(toUserMessage(err, 'upload'));
      setStatus('error');
      return false;
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
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
    cancel,
  };
}
