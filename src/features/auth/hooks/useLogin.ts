'use client';

import { useCallback, useState } from 'react';
import { ERROR_MESSAGES, authService, logError, toUserMessage, validateUserId } from '@/src/api';
import type { AsyncStatus } from '../types';
import { storeUserId } from '../lib/session-storage';


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
        setValidationError(check.error || ERROR_MESSAGES.client_validation);
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
        logError('Login failed:', err);
        setServerError(toUserMessage(err, 'login'));
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
