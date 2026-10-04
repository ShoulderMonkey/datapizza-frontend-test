'use client';

import { useCallback, useState } from 'react';
import { clearStoredUserId, getStoredUserId } from '../lib/session-storage';

/** Global session state: the only global state of the app (user id). */
export function useSession() {
  const [userId, setUserId] = useState<string | null>(() => getStoredUserId());

  const signIn = useCallback((newUserId: string) => setUserId(newUserId), []);

  const signOut = useCallback(() => {
    clearStoredUserId();
    setUserId(null);
  }, []);

  return { userId, signIn, signOut };
}
