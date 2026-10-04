import { describe, it, expect } from 'vitest';
import {
  ApiError,
  ERROR_MESSAGES,
  NDJSONParseError,
  apiErrorFromHttp,
  extractRejectedFilename,
  messageFor,
  messageKeyFor,
  message,
  toApiError,
  toUserMessage,
  type ErrorMessageKey,
} from '@/src/api';

const NOT_RECOGNIZED = (f: string) =>
  `File '${f}' is not recognized. Please upload one of the provided test documents.`;

describe('messageKeyFor: realistic backend inputs -> key', () => {
  it.each<[string, Parameters<typeof messageKeyFor>[0], ErrorMessageKey]>([
    ['network', { code: 'network' }, 'network'],
    ['abort', { code: 'aborted' }, 'aborted'],
    ['401', { code: 'unauthorized', endpoint: '/api/chat/', detail: 'Not authenticated. Please login first.' }, 'unauthorized'],
    ['404 chat', { code: 'not_found', endpoint: '/api/chat/abc', detail: 'Chat not found' }, 'chat_not_found'],
    ['404 pdf file', { code: 'not_found', endpoint: '/api/documents/x/file' }, 'pdf_not_found'],
    ['422 login', { code: 'validation', endpoint: '/api/auth/login' }, 'login_invalid'],
    ['400 upload not recognized', { code: 'bad_request', endpoint: '/api/documents/', detail: NOT_RECOGNIZED('a.pdf') }, 'upload_not_recognized'],
    ['422 upload without file', { code: 'validation', endpoint: '/api/documents/' }, 'upload_no_file'],
    ['400 query empty', { code: 'bad_request', endpoint: '/api/chat/', detail: 'Query must not be empty.' }, 'query_empty'],
    ['400 query too long', { code: 'bad_request', endpoint: '/api/chat/', detail: 'Query is too long. Maximum length is 10000 characters.' }, 'query_too_long'],
    ['stream parse (malformed line)', { code: 'stream_parse' }, 'stream_malformed'],
    ['500', { code: 'server' }, 'server'],
    ['418', { code: 'http' }, 'http'],
    ['400 elsewhere', { code: 'bad_request', endpoint: '/api/other', detail: 'x' }, 'bad_request'],
  ])('%s', (_n, input, key) => {
    expect(messageKeyFor(input)).toBe(key);
  });

  it('too long is not confused with empty and vice versa', () => {
    expect(messageKeyFor({ code: 'bad_request', endpoint: '/api/chat/', detail: 'Query must not be empty.' })).not.toBe('query_too_long');
    expect(messageKeyFor({ code: 'bad_request', endpoint: '/api/chat/', detail: 'Query is too long. Maximum length is 10000 characters.' })).not.toBe('query_empty');
  });
});

describe('ApiError.userMessage comes from ERROR_MESSAGES (end to end from the HTTP response)', () => {
  const cases: [string, Parameters<typeof apiErrorFromHttp>[0], string][] = [
    ['401', { status: 401, endpoint: '/api/chat/', body: { detail: 'Not authenticated. Please login first.' } }, ERROR_MESSAGES.unauthorized],
    ['404 chat', { status: 404, endpoint: '/api/chat/abc', body: { detail: 'Chat not found' } }, ERROR_MESSAGES.chat_not_found],
    ['422 login', { status: 422, endpoint: '/api/auth/login', body: { detail: [{ msg: 'Value error, user_id ...' }] } }, ERROR_MESSAGES.login_invalid],
    ['422 upload no file', { status: 422, endpoint: '/api/documents/', body: { detail: [{ type: 'missing', loc: ['body', 'files'], msg: 'Field required' }] } }, ERROR_MESSAGES.upload_no_file],
    ['400 query empty', { status: 400, endpoint: '/api/chat/', body: { detail: 'Query must not be empty.' } }, ERROR_MESSAGES.query_empty],
    ['400 query too long', { status: 400, endpoint: '/api/chat/', body: { detail: 'Query is too long. Maximum length is 10000 characters.' } }, ERROR_MESSAGES.query_too_long],
  ];
  it.each(cases)('%s', (_n, input, expected) => {
    expect(apiErrorFromHttp(input).userMessage).toBe(expected);
  });

  it('400 upload "not recognized" embeds the extracted filename', () => {
    const err = apiErrorFromHttp({ status: 400, endpoint: '/api/documents/', body: { detail: NOT_RECOGNIZED('non-ammesso.pdf') } });
    expect(err.userMessage).toBe(message('upload_not_recognized', { filename: 'non-ammesso.pdf' }));
    expect(err.userMessage).toContain('«non-ammesso.pdf»');
    expect(err.userMessage).not.toMatch(/is not recognized|Please upload/);
  });

  it('abort and malformed line map to the map texts', () => {
    expect(toApiError(new DOMException('x', 'AbortError')).userMessage).toBe(ERROR_MESSAGES.aborted);
    expect(toApiError(new NDJSONParseError('{bad', new Error('x'))).userMessage).toBe(ERROR_MESSAGES.stream_malformed);
    expect(toApiError(new TypeError('Failed to fetch'), { fallbackCode: 'network' }).userMessage).toBe(ERROR_MESSAGES.network);
  });
});

describe('extractRejectedFilename', () => {
  it.each(['con spazi.pdf', "l'apostrofo.pdf", 'è già così ☃ 文書.pdf', "it's 'quoted'.pdf", 'a.b.c.pdf'])('extracts %s', (name) => {
    expect(extractRejectedFilename(NOT_RECOGNIZED(name))).toBe(name);
    expect(messageFor({ code: 'bad_request', endpoint: '/api/documents/', detail: NOT_RECOGNIZED(name) })).toContain(`«${name}»`);
  });

  it.each([null, undefined, '', 'Something else entirely', 'File without quotes is not recognized'])(
    'non conforming detail %j -> null and the generic message',
    (detail) => {
      expect(extractRejectedFilename(detail)).toBeNull();
    }
  );

  it('a detail that matches the key but not the pattern gives the generic message, not "«null»"', () => {
    const msg = messageFor({ code: 'bad_request', endpoint: '/api/documents/', detail: 'Files not recognized' });
    expect(msg).toBe(ERROR_MESSAGES.upload_not_recognized({ filename: null }));
    expect(msg).not.toMatch(/«|null|undefined/);
  });
});

describe('toUserMessage', () => {
  it('uses the ApiError userMessage, except for unknown/non-ApiError which get the context fallback', () => {
    const e = apiErrorFromHttp({ status: 401, body: null });
    expect(toUserMessage(e, 'upload')).toBe(ERROR_MESSAGES.unauthorized);
    expect(toUserMessage(new Error('Error: secret at foo (file.js:1)'), 'upload')).toBe(ERROR_MESSAGES.fallback_upload);
    expect(toUserMessage('boom', 'login')).toBe(ERROR_MESSAGES.fallback_login);
    expect(toUserMessage(toApiError('x'), 'documents')).toBe(ERROR_MESSAGES.fallback_documents);
    expect(toUserMessage(new ApiError({ status: null, code: 'unknown', userMessage: 'x', cause: null }), 'pdf')).toBe(ERROR_MESSAGES.fallback_pdf);
  });
});

describe('no user-facing message leaks technical details', () => {
  const rendered = Object.entries(ERROR_MESSAGES).map(([key, entry]) => [
    key,
    typeof entry === 'function' ? entry({ filename: 'esempio.pdf' }) : entry,
  ]) as [string, string][];

  it('covers every key', () => {
    expect(rendered.length).toBe(Object.keys(ERROR_MESSAGES).length);
    expect(rendered.length).toBeGreaterThan(20);
  });

  // The user_id length limit (100) is a documented input rule, not an HTTP status.
  const LENGTH_LIMIT_KEYS = ['login_invalid', 'user_id_too_long'];

  it.each(rendered)('%s: Italian text without status codes, detail, URL or stack', (key, text) => {
    expect(text.trim().length).toBeGreaterThan(0);
    const numbers = text.match(/\b\d{3}\b/g) ?? [];
    expect(numbers).toEqual(LENGTH_LIMIT_KEYS.includes(key) ? ['100'] : []);
    expect(text).not.toMatch(/detail/i);
    expect(text).not.toMatch(/localhost/i);
    expect(text).not.toMatch(/http/i);
    expect(text).not.toMatch(/Error:/);
    expect(text).not.toMatch(/\bat \S+/);
  });
});
