export class ApiClientError extends Error {
  statusCode?: number;
  details?: unknown;
  isNetworkError: boolean;
  endpoint: string;

  constructor(message: string, options?: { statusCode?: number; details?: unknown; isNetworkError?: boolean; endpoint?: string }) {
    super(message);
    this.name = 'ApiClientError';
    this.statusCode = options?.statusCode;
    this.details = options?.details;
    this.isNetworkError = options?.isNetworkError ?? false;
    this.endpoint = options?.endpoint ?? '';
  }
}

/**
 * Normalizes error messages from backend responses into readable user strings.
 */
function extractErrorMessage(body: unknown, status: number): string {
  if (typeof body === 'string') {
    return body;
  }
  if (body && typeof body === 'object') {
    const obj = body as Record<string, unknown>;
    if (typeof obj.detail === 'string') return obj.detail;
    if (Array.isArray(obj.detail)) {
      // FastAPI validation error format
      return obj.detail.map((d: { msg?: string; loc?: string[] }) => d.msg ?? JSON.stringify(d)).join(', ');
    }
    if (typeof obj.message === 'string') return obj.message;
    if (typeof obj.error === 'string') return obj.error;
  }

  if (status === 401) return 'Sessione non autenticata o scaduta. Effettua il login.';
  if (status === 403) return 'Accesso non autorizzato alla risorsa richiesta.';
  if (status === 404) return 'La risorsa richiesta non è stata trovata.';
  if (status === 500) return 'Errore interno del server backend.';
  return `Richiesta fallita con codice ${status}`;
}

/**
 * All backend calls go through the same-origin proxy (`rewrites` in next.config.ts),
 * so URLs are always relative and start with `/api/`.
 */
export function toApiUrl(endpoint: string): string {
  return endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
}

export async function request<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = toApiUrl(endpoint);

  const headers = new Headers(options.headers || {});
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json, text/plain, */*');
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'same-origin', // same-origin proxy: the user_id cookie is first-party
    });

    if (!response.ok) {
      let errorBody: unknown = null;
      try {
        const text = await response.text();
        errorBody = text ? JSON.parse(text) : null;
      } catch {
        // Not JSON
      }

      const message = extractErrorMessage(errorBody, response.status);
      throw new ApiClientError(message, {
        statusCode: response.status,
        details: errorBody,
        isNetworkError: false,
        endpoint,
      });
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return (await response.json()) as T;
    }
    return (await response.text()) as unknown as T;
  } catch (err: unknown) {
    if (err instanceof ApiClientError) {
      throw err;
    }

    // Network errors (CORS, Connection Refused, DNS failure, etc.)
    const isAbort = (err as Error)?.name === 'AbortError';
    if (isAbort) {
      throw err;
    }

    const networkMsg = `Impossibile raggiungere il backend. Verifica che il server sia avviato e raggiungibile.`;
    throw new ApiClientError(networkMsg, {
      details: err,
      isNetworkError: true,
      endpoint,
    });
  }
}

/**
 * Performs a raw fetch with credentials for streaming responses or binary downloads.
 */
export async function rawRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = toApiUrl(endpoint);

  try {
    const response = await fetch(url, {
      ...options,
      credentials: 'same-origin',
    });

    if (!response.ok) {
      let errorBody: unknown = null;
      try {
        const text = await response.text();
        errorBody = text ? JSON.parse(text) : null;
      } catch {
        // Not JSON
      }

      const message = extractErrorMessage(errorBody, response.status);
      throw new ApiClientError(message, {
        statusCode: response.status,
        details: errorBody,
        isNetworkError: false,
        endpoint,
      });
    }

    return response;
  } catch (err: unknown) {
    if (err instanceof ApiClientError) {
      throw err;
    }
    if ((err as Error)?.name === 'AbortError') {
      throw err;
    }

    const networkMsg = `Connessione non riuscita verso ${endpoint}. Controlla la connessione al server.`;
    throw new ApiClientError(networkMsg, {
      details: err,
      isNetworkError: true,
      endpoint,
    });
  }
}
