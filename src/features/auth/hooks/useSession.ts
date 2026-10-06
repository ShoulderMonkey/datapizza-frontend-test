'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ERROR_MESSAGES, resetUnauthorizedGuard, setUnauthorizedHandler } from '@/src/api';
import { clearStoredUserId, getStoredUserId, subscribeToStoredUserId } from '../lib/session-storage';

export type SessionStatus = 'hydrating' | 'authenticated' | 'anonymous';

/**
 * Global session state: the only global state of the app (user id).
 * The first render is always `hydrating` (identical on server and client); localStorage is
 * read in an effect after mount, so there is no hydration mismatch; afterwards the `storage`
 * event keeps this tab aligned when another tab logs out or switches user. The real session is the
 * HttpOnly cookie: any 401 from the API layer signs the user out with `notice`.
 */
export function useSession() {
  const [userId, setUserId] = useState<string | null>(null);
  const [status, setStatus] = useState<SessionStatus>('hydrating');
  const [notice, setNotice] = useState<string | null>(null);
  const userIdRef = useRef<string | null>(null);
  userIdRef.current = userId;

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

  useEffect(
    () =>
      subscribeToStoredUserId((next) => {
        if (next === userIdRef.current) return;
        if (next === null) {
          setUserId(null);
          setStatus('anonymous');
          setNotice(ERROR_MESSAGES.signed_out_elsewhere);
          return;
        }
        resetUnauthorizedGuard();
        setNotice(null);
        setUserId(next);
        setStatus('authenticated');
      }),
    []
  );

  return { userId, status, notice, signIn, signOut };
}
