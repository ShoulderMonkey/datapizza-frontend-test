import { request } from './api-client';
import { LoginRequest, LoginResponse } from '@/types/auth';

const AUTH_USER_KEY = 'docfact_auth_user_id';
const USER_ID_REGEX = /^[a-zA-Z0-9_-]+$/;

export function validateUserId(userId: string): { isValid: boolean; error?: string } {
  const trimmed = userId.trim();
  if (!trimmed) {
    return { isValid: false, error: 'Lo user_id è obbligatorio.' };
  }
  if (!USER_ID_REGEX.test(trimmed)) {
    return {
      isValid: false,
      error: 'Lo user_id può contenere solo caratteri alfanumerici, trattini (-) e underscore (_).',
    };
  }
  if (trimmed.length > 64) {
    return { isValid: false, error: 'Lo user_id non può superare 64 caratteri.' };
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
    const response = await request<LoginResponse>('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

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
