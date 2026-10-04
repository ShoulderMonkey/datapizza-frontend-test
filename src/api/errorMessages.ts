/**
 * The single source of user-facing error texts (Italian). Nothing else in `src/` defines an
 * error string shown to the user. Technical details (status, backend `detail`, stack, URL)
 * never go here: they stay in `ApiError.cause` / `ApiError.detail` and in the console.
 *
 * Pure module: no imports from the rest of the API layer (avoids cycles).
 */

export const USER_ID_MAX_LENGTH_FOR_MESSAGES = 100; // mirrored by USER_ID_MAX_LENGTH in auth.ts

type MessageParams = { filename?: string | null };
type MessageEntry = string | ((params: MessageParams) => string);

/** Key → message. Keys are semantic, not HTTP codes. */
export const ERROR_MESSAGES = {
  // Transport
  network: 'Impossibile raggiungere il backend. Verifica che il server sia avviato e raggiungibile.',
  aborted: "Generazione interrotta dall'utente.",
  // Auth
  unauthorized: 'Sessione non autenticata o scaduta. Effettua il login.',
  login_invalid: `User ID non valido: usa solo lettere, numeri, - e _ (max ${USER_ID_MAX_LENGTH_FOR_MESSAGES} caratteri).`,
  // Chat
  chat_not_found: 'La conversazione richiesta non esiste più.',
  query_empty: 'La domanda è vuota: scrivi qualcosa prima di inviare.',
  query_too_long: 'La domanda è troppo lunga: il limite è di 10000 caratteri.',
  stream_error_chunk:
    'La generazione della risposta si è interrotta. Il testo parziale è stato conservato: puoi riprovare.',
  stream_malformed: 'Risposta del server non leggibile. Riprova.',
  stream_error_title: 'Risposta interrotta da un errore',
  stream_error_fallback: 'La richiesta al server è fallita o il flusso è stato interrotto.',
  stream_no_body: 'Il server non ha restituito un flusso di risposta.',
  // Documents
  upload_not_recognized: ({ filename }) =>
    filename
      ? `«${filename}» non è uno dei documenti di test riconosciuti dal backend.`
      : 'Uno o più file non sono tra i documenti di test riconosciuti dal backend.',
  upload_no_file: 'Nessun file ricevuto: seleziona almeno un PDF.',
  upload_not_pdf: ({ filename }) =>
    filename ? `Il file «${filename}» non è un documento PDF valido.` : 'Il file selezionato non è un PDF valido.',
  document_list_title: 'Impossibile recuperare i documenti',
  pdf_not_found: 'Il file PDF richiesto non è disponibile sul server.',
  pdf_render: 'Impossibile aprire il file PDF.',
  // Client-side validation of user_id
  user_id_required: 'Lo user_id è obbligatorio.',
  user_id_too_long: `Lo user_id non può superare ${USER_ID_MAX_LENGTH_FOR_MESSAGES} caratteri.`,
  user_id_charset: 'Lo user_id può contenere solo lettere (a-z), numeri, trattini (-) e underscore (_).',
  // Generic
  bad_request: 'La richiesta non è valida. Controlla i dati inseriti e riprova.',
  forbidden: 'Accesso non autorizzato alla risorsa richiesta.',
  not_found: 'La risorsa richiesta non è stata trovata.',
  validation: 'I dati inviati non sono validi.',
  server: 'Errore interno del server backend.',
  http: 'Richiesta fallita. Riprova tra qualche istante.',
  invalid_response: 'Il server ha restituito una risposta inattesa.',
  client_validation: 'Dati non validi.',
  unknown: 'Si è verificato un errore imprevisto. Riprova.',
  // Fallbacks per context
  fallback_login: 'Impossibile completare il login. Verifica la connessione al backend.',
  fallback_upload: 'Non è stato possibile caricare i documenti. Controlla i file e riprova.',
  fallback_documents: 'Non è stato possibile caricare la lista documenti.',
  fallback_chat_list: 'Non è stato possibile caricare la cronologia.',
  fallback_chat_detail: 'Impossibile caricare i messaggi della conversazione.',
  fallback_pdf: 'Impossibile caricare il file PDF dal server.',
  fallback_chat_stream: 'La risposta si è interrotta. Puoi riprovare.',
} as const satisfies Record<string, MessageEntry>;

export type ErrorMessageKey = keyof typeof ERROR_MESSAGES;

/** Where an error is shown; selects the fallback for unexpected errors. */
export type ErrorContext =
  | 'login'
  | 'upload'
  | 'documents'
  | 'chat_list'
  | 'chat_detail'
  | 'pdf'
  | 'chat_stream';

const CONTEXT_FALLBACK: Record<ErrorContext, ErrorMessageKey> = {
  login: 'fallback_login',
  upload: 'fallback_upload',
  documents: 'fallback_documents',
  chat_list: 'fallback_chat_list',
  chat_detail: 'fallback_chat_detail',
  pdf: 'fallback_pdf',
  chat_stream: 'fallback_chat_stream',
};

export function fallbackKeyFor(context: ErrorContext): ErrorMessageKey {
  return CONTEXT_FALLBACK[context];
}

/** Renders a key (with optional params). */
export function message(key: ErrorMessageKey, params: MessageParams = {}): string {
  const entry: MessageEntry = ERROR_MESSAGES[key];
  return typeof entry === 'function' ? entry(params) : entry;
}

/**
 * Extracts `<filename>` from the backend text
 * `File '<filename>' is not recognized. Please upload one of the provided test documents.`
 * (BE:src/routes/documents.py:53-56). Returns null when the text does not match.
 */
export function extractRejectedFilename(detail: string | null | undefined): string | null {
  if (!detail) return null;
  const match = /^File '([\s\S]+)' is not recognized\b/.exec(detail);
  return match ? match[1] : null;
}

export interface ErrorMessageInput {
  code: string;
  endpoint?: string | null;
  detail?: string | null;
}

/**
 * Picks the message key from the normalized error code, the endpoint and the backend detail.
 * Backend texts: BE:src/routes/chat.py:228-236 (query empty / too long),
 * BE:src/routes/documents.py:53-56 (not recognized) and the unreachable "No files provided".
 */
export function messageKeyFor({ code, endpoint, detail }: ErrorMessageInput): ErrorMessageKey {
  const path = (endpoint ?? '').split('?')[0];
  const text = (detail ?? '').toLowerCase();
  const isChatPost = path === '/api/chat/' || path === '/api/chat';
  const isChatItem = path.startsWith('/api/chat/') && !isChatPost;
  const isDocumentsPost = path === '/api/documents/' || path === '/api/documents';
  const isDocumentFile = path.startsWith('/api/documents/') && path.endsWith('/file');

  switch (code) {
    case 'network':
    case 'aborted':
    case 'unauthorized':
    case 'forbidden':
    case 'server':
    case 'invalid_response':
    case 'client_validation':
      return code;
    case 'stream_parse':
      return 'stream_malformed';
    case 'not_found':
      if (isChatItem) return 'chat_not_found';
      if (isDocumentFile) return 'pdf_not_found';
      return 'not_found';
    case 'bad_request':
      if (isChatPost) {
        if (text.includes('too long')) return 'query_too_long';
        if (text.includes('empty')) return 'query_empty';
      }
      if (isDocumentsPost) {
        if (text.includes('not recognized')) return 'upload_not_recognized';
        if (text.includes('no files')) return 'upload_no_file';
      }
      return 'bad_request';
    case 'validation':
      if (path === '/api/auth/login') return 'login_invalid';
      if (isDocumentsPost) return 'upload_no_file';
      return 'validation';
    case 'http':
      return 'http';
    default:
      return 'unknown';
  }
}

/** Message text for a normalized error description (used when building an ApiError). */
export function messageFor(input: ErrorMessageInput): string {
  const key = messageKeyFor(input);
  return message(key, { filename: key === 'upload_not_recognized' ? extractRejectedFilename(input.detail) : null });
}
