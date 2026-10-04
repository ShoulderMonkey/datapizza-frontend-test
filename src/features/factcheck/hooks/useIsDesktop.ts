'use client';

import { useSyncExternalStore } from 'react';

/** Tailwind `lg` breakpoint: from here the fact-check viewer is a side panel, below it a drawer. */
const DESKTOP_QUERY = '(min-width: 1024px)';

const subscribe = (onChange: () => void) => {
  const mql = window.matchMedia(DESKTOP_QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
};

/** `true` at viewport >= 1024 px. Server snapshot is `false` (the panel only renders client-side). */
export function useIsDesktop(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => false
  );
}
