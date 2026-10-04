/**
 * Public surface of the API layer. Features import from `@/src/api` only;
 * `fetch` is allowed exclusively inside src/api/** (eslint.config.mjs).
 */
export { request, requestRaw, requestStream, toApiUrl, type RequestOptions } from './client';
export {
  ApiError,
  DEFAULT_USER_MESSAGES,
  apiErrorFromHttp,
  createApiError,
  extractDetail,
  getUserMessage,
  isAbortError,
  statusToCode,
  toApiError,
  type ApiErrorCode,
  type ApiErrorInit,
  type ErrorMessageOverrides,
} from './errors';
export { NDJSONParseError, NDJSON_PARSE_ERROR_MESSAGE, parseNDJSONStream } from './ndjson';
export { authService, validateUserId, USER_ID_MAX_LENGTH, USER_ID_INVALID_MESSAGE } from './auth';
export { documentService, isPdfFile } from './documents';
export { chatService } from './chat';
export type * from './types';
