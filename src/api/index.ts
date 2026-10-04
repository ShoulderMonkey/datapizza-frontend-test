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
  logError,
  toUserMessage,
  isAbortError,
  statusToCode,
  toApiError,
  type ApiErrorCode,
  type ApiErrorInit,
} from './errors';
export {
  ERROR_MESSAGES,
  extractRejectedFilename,
  message,
  messageFor,
  messageKeyFor,
  type ErrorContext,
  type ErrorMessageKey,
} from './errorMessages';
export { notifyUnauthorized, resetUnauthorizedGuard, setUnauthorizedHandler } from './session';
export { NDJSONParseError, parseNDJSONStream } from './ndjson';
export { authService, validateUserId, USER_ID_MAX_LENGTH, USER_ID_INVALID_MESSAGE } from './auth';
export { documentService, isPdfFile } from './documents';
export { chatService } from './chat';
export type * from './types';
