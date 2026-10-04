/**
 * Single point where the API layer reports "the session is no longer valid" (HTTP 401).
 * The client calls `notifyUnauthorized()` for every 401 except the login endpoint; the
 * session (src/features/auth) registers the handler and reacts with a sign-out.
 * Concurrent 401s collapse into one notification until `resetUnauthorizedGuard()` is
 * called (on the next successful sign-in).
 */
type UnauthorizedHandler = () => void;

let handler: UnauthorizedHandler | null = null;
let notified = false;

/** Registers the handler (null to unregister). Returns an unsubscribe function. */
export function setUnauthorizedHandler(next: UnauthorizedHandler | null): () => void {
  handler = next;
  return () => {
    if (handler === next) handler = null;
  };
}

export function notifyUnauthorized(): void {
  if (notified || !handler) return;
  notified = true;
  handler();
}

export function resetUnauthorizedGuard(): void {
  notified = false;
}
