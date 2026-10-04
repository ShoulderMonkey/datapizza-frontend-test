import { request, ApiClientError } from './api-client';
import { LoginRequest, LoginResponse } from '@/types/auth';

const AUTH_USER_KEY = 'docfact_auth_user_id';
const USER_ID_REGEX = /^[a-zA-Z0-9_-]+$/;

/**
 * Lunghezza massima di user_id.
 * Fonte: BE:src/routes/auth.py:15 (../test-tecnico-frontend-engineer/backend/src/routes/auth.py);
 * non è presente in docs/api/openapi.json.
 */
export const USER_ID_MAX_LENGTH = 100;

export const USER_ID_INVALID_MESSAGE = `User ID non valido: usa solo lettere, numeri, - e _ (max ${USER_ID_MAX_LENGTH} caratteri).`;

export function validateUserId(userId: string): { isValid: boolean; error?: string } {
  const trimmed = userId.trim();
  if (!trimmed) {
    return { isValid: false, error: 'Lo user_id è obbligatorio.' };
  }
  if (trimmed.length > USER_ID_MAX_LENGTH) {
    return {
      isValid: false,
      error: `Lo user_id non può superare ${USER_ID_MAX_LENGTH} caratteri.`,
    };
  }
  // Più restrittivo del backend (str.isalnum accetta anche Unicode): solo ASCII.
  if (!USER_ID_REGEX.test(trimmed)) {
    return {
      isValid: false,
      error: 'Lo user_id può contenere solo lettere (a-z), numeri, trattini (-) e underscore (_).',
    };
  }
  return { isValid: true };
}

export const authService = {
  /**
   * Logs in a user by setting the mock cookie via the backend.
   */
  async login(userId: string): Promise<LoginResponse> {
    const validation = validateUserId(userId);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    const payload: LoginRequest = { user_id: userId.trim() };
    let response: LoginResponse;
    try {
      response = await request<LoginResponse>('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch (err: unknown) {
      if (err instanceof ApiClientError && err.statusCode === 422) {
        // Dettaglio tecnico (Pydantic) solo in console, non mostrato all'utente.
        console.error('Login 422:', err.details ?? err.message);
        throw new Error(USER_ID_INVALID_MESSAGE);
      }
      throw err;
    }

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(AUTH_USER_KEY, userId.trim());
      } catch {
        // ignore storage errors
      }
    }

    return response;
  },

  /**
   * Returns the stored local user ID if available.
   */
  getStoredUserId(): string | null {
    if (typeof window === 'undefined') return null;
    try {
      return localStorage.getItem(AUTH_USER_KEY);
    } catch {
      return null;
    }
  },

  /**
   * Clears the stored user.
   */
  logout(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(AUTH_USER_KEY);
    } catch {
      // ignore
    }
  },
};
