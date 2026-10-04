'use client';

import { useCallback, useState } from 'react';
import { authService, getUserMessage, validateUserId } from '@/src/api';
import type { AsyncStatus } from '../types';
import { storeUserId } from '../lib/session-storage';

const LOGIN_FALLBACK_MESSAGE = 'Impossibile completare il login. Verifica la connessione al backend.';

/**
 * Orchestrates the login: client validation, POST /api/auth/login, local persistence.
 * `validationError` = rejected before the request; `serverError` = ApiError.userMessage.
 */
export function useLogin(onSuccess: (userId: string) => void) {
  const [status, setStatus] = useState<AsyncStatus>('idle');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const clearErrors = useCallback(() => {
    setValidationError(null);
    setServerError(null);
  }, []);

  const login = useCallback(
    async (rawUserId: string) => {
      clearErrors();
      const check = validateUserId(rawUserId);
      if (!check.isValid) {
        setValidationError(check.error || 'User ID non valido.');
        return;
      }

      const userId = rawUserId.trim();
      setStatus('loading');
      try {
        await authService.login(userId);
        storeUserId(userId);
        setStatus('success');
        onSuccess(userId);
      } catch (err: unknown) {
        console.error('Login failed:', err);
        setServerError(getUserMessage(err, LOGIN_FALLBACK_MESSAGE));
        setStatus('error');
      }
    },
    [clearErrors, onSuccess]
  );

  return {
    status,
    isLoading: status === 'loading',
    validationError,
    serverError,
    clearErrors,
    login,
  };
}
