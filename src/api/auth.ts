import { request } from './client';
import { ApiError, createApiError } from './errors';
import { ERROR_MESSAGES, message } from './errorMessages';
import type { LoginRequest, LoginResponse } from './types';

const USER_ID_REGEX = /^[a-zA-Z0-9_-]+$/;

/**
 * Lunghezza massima di user_id.
 * Fonte: BE:src/routes/auth.py:15 (../test-tecnico-frontend-engineer/backend/src/routes/auth.py);
 * non è presente in docs/api/openapi.json.
 */
export const USER_ID_MAX_LENGTH = 100;

export const USER_ID_INVALID_MESSAGE = ERROR_MESSAGES.login_invalid;

/** Client-side mirror of the backend rule (BE:src/routes/auth.py:13-21), ASCII only. */
export function validateUserId(userId: string): { isValid: boolean; error?: string } {
  const trimmed = userId.trim();
  if (!trimmed) {
    return { isValid: false, error: message('user_id_required') };
  }
  if (trimmed.length > USER_ID_MAX_LENGTH) {
    return {
      isValid: false,
      error: message('user_id_too_long'),
    };
  }
  // Più restrittivo del backend (str.isalnum accetta anche Unicode): solo ASCII.
  if (!USER_ID_REGEX.test(trimmed)) {
    return {
      isValid: false,
      error: message('user_id_charset'),
    };
  }
  return { isValid: true };
}

export const authService = {
  /**
   * POST /api/auth/login: the backend sets the `user_id` cookie (HttpOnly, SameSite=lax).
   * Throws ApiError: `client_validation` for an invalid id, `validation` (422) mapped to
   * the `login_invalid` message, or any other ApiError of the client.
   */
  async login(userId: string): Promise<LoginResponse> {
    const validation = validateUserId(userId);
    if (!validation.isValid) {
      throw createApiError('client_validation', { userMessage: validation.error, endpoint: '/api/auth/login' });
    }

    const payload: LoginRequest = { user_id: userId.trim() };
    try {
      return await request<LoginResponse>('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err: unknown) {
      if (err instanceof ApiError && err.code === 'validation') {
        // Dettaglio tecnico (Pydantic) solo in console, non mostrato all'utente.
        console.error('Login 422:', err.cause ?? err.detail);
      }
      throw err;
    }
  },
};
