export const DEFAULT_API_BASE_URL = 'http://localhost:8000';
const STORAGE_KEY = 'docfact_api_base_url';

/**
 * Returns the configured backend API base URL.
 * Checks localStorage first (allowing runtime developer configuration),
 * then falls back to NEXT_PUBLIC_API_URL or DEFAULT_API_BASE_URL.
 */
export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && stored.trim().length > 0) {
        return stored.trim().replace(/\/+$/, '');
      }
    } catch {
      // localStorage may fail in restricted sandboxes
    }
  }

  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (envUrl && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/+$/, '');
  }

  return DEFAULT_API_BASE_URL;
}

/**
 * Updates the runtime API base URL in localStorage.
 */
export function setApiBaseUrl(url: string): void {
  if (typeof window === 'undefined') return;
  const sanitized = url.trim().replace(/\/+$/, '');
  try {
    if (!sanitized || sanitized === DEFAULT_API_BASE_URL) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, sanitized);
    }
    // Dispatch a custom event so components can react immediately without reload
    window.dispatchEvent(new CustomEvent('docfact:api_url_changed', { detail: sanitized || DEFAULT_API_BASE_URL }));
  } catch (err) {
    console.error('Failed to save API base URL to localStorage', err);
  }
}

/**
 * Resets the API base URL to the default value.
 */
export function resetApiBaseUrl(): void {
  setApiBaseUrl(DEFAULT_API_BASE_URL);
}
