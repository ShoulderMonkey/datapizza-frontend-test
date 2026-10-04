'use client';

import { useCallback, useEffect, useState } from 'react';
import { ERROR_MESSAGES, resetUnauthorizedGuard, setUnauthorizedHandler } from '@/src/api';
import { clearStoredUserId, getStoredUserId } from '../lib/session-storage';

export type SessionStatus = 'hydrating' | 'authenticated' | 'anonymous';

/**
 * Global session state: the only global state of the app (user id).
 * The first render is always `hydrating` (identical on server and client); localStorage is
 * read in an effect after mount, so there is no hydration mismatch. The real session is the
 * HttpOnly cookie: any 401 from the API layer signs the user out with `notice`.
 */
export function useSession() {
  const [userId, setUserId] = useState<string | null>(null);
  const [status, setStatus] = useState<SessionStatus>('hydrating');
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const stored = getStoredUserId();
    setUserId(stored);
    setStatus(stored ? 'authenticated' : 'anonymous');
  }, []);

  const signIn = useCallback((newUserId: string) => {
    resetUnauthorizedGuard();
    setNotice(null);
    setUserId(newUserId);
    setStatus('authenticated');
  }, []);

  const signOut = useCallback(() => {
    clearStoredUserId();
    setUserId(null);
    setStatus('anonymous');
  }, []);

  useEffect(
    () =>
      setUnauthorizedHandler(() => {
        clearStoredUserId();
        setUserId(null);
        setStatus('anonymous');
        setNotice(ERROR_MESSAGES.session_expired);
      }),
    []
  );

  return { userId, status, notice, signIn, signOut };
}
