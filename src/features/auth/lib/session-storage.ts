/**
 * Local persistence of the logged-in user id (UI convenience only: the real session
 * is the HttpOnly `user_id` cookie set by the backend, which JS cannot read).
 */
const AUTH_USER_KEY = 'docfact_auth_user_id';

export function getStoredUserId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(AUTH_USER_KEY);
  } catch {
    return null;
  }
}

export function storeUserId(userId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(AUTH_USER_KEY, userId);
  } catch {
    // ignore storage errors
  }
}

export function clearStoredUserId(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(AUTH_USER_KEY);
  } catch {
    // ignore storage errors
  }
}
