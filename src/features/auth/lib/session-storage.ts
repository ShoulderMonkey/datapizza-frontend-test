/**
 * Local persistence of the logged-in user id (UI convenience only: the real session
 * is the HttpOnly `user_id` cookie set by the backend, which JS cannot read).
 */
export const AUTH_USER_KEY = 'docfact_auth_user_id';

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

/**
 * Subscribes to identity changes made by other tabs (the `storage` event only fires in the
 * other documents). `null` means the user id was removed (`key === null` is `localStorage.clear()`).
 * Returns the cleanup function.
 */
export function subscribeToStoredUserId(callback: (userId: string | null) => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const handler = (event: StorageEvent) => {
    if (event.key !== null && event.key !== AUTH_USER_KEY) return;
    callback(event.key === null ? null : event.newValue);
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}
