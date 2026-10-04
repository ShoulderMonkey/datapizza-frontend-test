import { NDJSONParseError, NDJSON_PARSE_ERROR_MESSAGE } from './ndjson';

/**
 * Normalized error codes of the API layer.
 *
 * | code                | status      | when                                                           |
 * |---------------------|-------------|----------------------------------------------------------------|
 * | `network`           | `null`      | `fetch` (or reading the body) rejected: backend down, DNS, ... |
 * | `aborted`           | `null`      | `AbortController.abort()`: user stop, unmount, chat switch     |
 * | `bad_request`       | 400         | backend `HTTPException(400, detail: string)`                   |
 * | `unauthorized`      | 401         | missing/invalid `user_id` cookie                               |
 * | `forbidden`         | 403         |                                                                |
 * | `not_found`         | 404         |                                                                |
 * | `validation`        | 422         | FastAPI/Pydantic validation, `detail` is an array              |
 * | `server`            | >= 500      |                                                                |
 * | `http`              | other non-2xx                                                                |
 * | `invalid_response`  | 2xx         | the response has no body / not the expected shape              |
 * | `stream_parse`      | `null`      | an NDJSON line is not valid JSON or has no string `type`       |
 * | `client_validation` | `null`      | input rejected client-side, before any request                 |
 * | `unknown`           | `null`      | anything else                                                  |
 */
export type ApiErrorCode =
  | 'network'
  | 'aborted'
  | 'bad_request'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'validation'
  | 'server'
  | 'http'
  | 'invalid_response'
  | 'stream_parse'
  | 'client_validation'
  | 'unknown';

/** Per-call overrides of the user-facing message, keyed by code. */
export type ErrorMessageOverrides = Partial<Record<ApiErrorCode, string>>;

/** Code → user-facing message (Italian). Technical details only go to the console. */
export const DEFAULT_USER_MESSAGES: Readonly<Record<ApiErrorCode, string>> = {
  network: 'Impossibile raggiungere il backend. Verifica che il server sia avviato e raggiungibile.',
  aborted: 'Richiesta annullata.',
  bad_request: 'La richiesta non è valida. Controlla i dati inseriti e riprova.',
  unauthorized: 'Sessione non autenticata o scaduta. Effettua il login.',
  forbidden: 'Accesso non autorizzato alla risorsa richiesta.',
  not_found: 'La risorsa richiesta non è stata trovata.',
  validation: 'I dati inviati non sono validi.',
  server: 'Errore interno del server backend.',
  http: 'Richiesta fallita.',
  invalid_response: 'Il server ha restituito una risposta inattesa.',
  stream_parse: NDJSON_PARSE_ERROR_MESSAGE,
  client_validation: 'Dati non validi.',
  unknown: 'Si è verificato un errore imprevisto. Riprova.',
};

export interface ApiErrorInit {
  status: number | null;
  code: ApiErrorCode;
  userMessage: string;
  cause: unknown;
  /** Technical detail extracted from the backend body (console/debug only). */
  detail?: string | null;
  endpoint?: string | null;
}

/**
 * The only error type thrown by `src/api/**`.
 *
 * - `status`: HTTP status, or `null` when there is no HTTP response (network, abort, parse).
 * - `code`: see {@link ApiErrorCode}.
 * - `userMessage`: Italian text safe to show in the UI.
 * - `cause`: the original value (TypeError/DOMException/NDJSONParseError, or the parsed
 *   response body for HTTP errors).
 * - `message` (from Error): technical, for the console only.
 */
export class ApiError extends Error {
  readonly status: number | null;
  readonly code: ApiErrorCode;
  readonly userMessage: string;
  readonly cause: unknown;
  readonly detail: string | null;
  readonly endpoint: string | null;

  constructor(init: ApiErrorInit) {
    const where = init.endpoint ? ` ${init.endpoint}` : '';
    const status = init.status !== null ? ` HTTP ${init.status}` : '';
    const detail = init.detail ? `: ${init.detail}` : '';
    super(`[ApiError:${init.code}]${status}${where}${detail}`);
    this.name = 'ApiError';
    this.status = init.status;
    this.code = init.code;
    this.userMessage = init.userMessage;
    this.cause = init.cause;
    this.detail = init.detail ?? null;
    this.endpoint = init.endpoint ?? null;
  }

  /** True when the request was cancelled on purpose (do not show it as an error). */
  get isAborted(): boolean {
    return this.code === 'aborted';
  }
}

export function statusToCode(status: number): ApiErrorCode {
  if (status === 400) return 'bad_request';
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 422) return 'validation';
  if (status >= 500) return 'server';
  return 'http';
}

function userMessageFor(code: ApiErrorCode, status: number | null, overrides?: ErrorMessageOverrides): string {
  const override = overrides?.[code];
  if (override) return override;
  if (code === 'http' && status !== null) return `Richiesta fallita con codice ${status}.`;
  return DEFAULT_USER_MESSAGES[code];
}

/**
 * Extracts a technical detail string from a backend error body:
 * `detail: string` (HTTPException), `detail: [{ msg }]` (FastAPI 422), `message`, `error`.
 */
export function extractDetail(body: unknown): string | null {
  if (typeof body === 'string') return body || null;
  if (!body || typeof body !== 'object') return null;
  const obj = body as Record<string, unknown>;
  if (typeof obj.detail === 'string') return obj.detail;
  if (Array.isArray(obj.detail)) {
    const msgs = obj.detail.map((d: unknown) => {
      if (d && typeof d === 'object' && typeof (d as { msg?: unknown }).msg === 'string') {
        return (d as { msg: string }).msg;
      }
      return JSON.stringify(d);
    });
    return msgs.join(', ') || null;
  }
  if (typeof obj.message === 'string') return obj.message;
  if (typeof obj.error === 'string') return obj.error;
  return null;
}

/** Builds the ApiError for a non-2xx response whose body has already been read. */
export function apiErrorFromHttp(params: {
  status: number;
  body: unknown;
  endpoint?: string;
  messages?: ErrorMessageOverrides;
}): ApiError {
  const code = statusToCode(params.status);
  return new ApiError({
    status: params.status,
    code,
    userMessage: userMessageFor(code, params.status, params.messages),
    cause: params.body,
    detail: extractDetail(params.body),
    endpoint: params.endpoint ?? null,
  });
}

/** Builds an ApiError without an HTTP status (client validation, invalid response, ...). */
export function createApiError(
  code: Exclude<ApiErrorCode, 'bad_request' | 'unauthorized' | 'forbidden' | 'not_found' | 'validation' | 'server' | 'http'>,
  options: { userMessage?: string; cause?: unknown; detail?: string; endpoint?: string } = {}
): ApiError {
  return new ApiError({
    status: null,
    code,
    userMessage: options.userMessage ?? DEFAULT_USER_MESSAGES[code],
    cause: options.cause,
    detail: options.detail ?? null,
    endpoint: options.endpoint ?? null,
  });
}

function hasAbortName(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name: unknown }).name === 'AbortError'
  );
}

/**
 * Normalizes any thrown value into an ApiError.
 * - ApiError: returned as is;
 * - `name === 'AbortError'` (DOMException from fetch/reader/AbortSignal): `aborted`;
 * - NDJSONParseError: `stream_parse`;
 * - anything else: `fallbackCode` (`network` when the value comes from `fetch`/`reader.read()`,
 *   `unknown` otherwise).
 */
export function toApiError(
  error: unknown,
  options: { fallbackCode?: 'network' | 'unknown'; endpoint?: string; messages?: ErrorMessageOverrides } = {}
): ApiError {
  if (error instanceof ApiError) return error;
  const endpoint = options.endpoint ?? null;
  const messages = options.messages;

  if (hasAbortName(error)) {
    return new ApiError({ status: null, code: 'aborted', userMessage: userMessageFor('aborted', null, messages), cause: error, endpoint });
  }
  if (error instanceof NDJSONParseError) {
    return new ApiError({
      status: null,
      code: 'stream_parse',
      userMessage: userMessageFor('stream_parse', null, messages),
      cause: error,
      detail: error.line,
      endpoint,
    });
  }
  const code = options.fallbackCode ?? 'unknown';
  return new ApiError({
    status: null,
    code,
    userMessage: userMessageFor(code, null, messages),
    cause: error,
    detail: error instanceof Error ? error.message : null,
    endpoint,
  });
}

/** True for a deliberate cancellation (ApiError `aborted` or a raw AbortError). */
export function isAbortError(error: unknown): boolean {
  return error instanceof ApiError ? error.code === 'aborted' : hasAbortName(error);
}

/** Message to show in the UI: the ApiError `userMessage`, otherwise `fallback`. */
export function getUserMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.userMessage : fallback;
}
