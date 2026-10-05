'use client';

import { useCallback, useState, useSyncExternalStore } from 'react';

/** Tailwind `md` breakpoint: from here the sidebar is a static column, below it an overlay. */
const WIDE_QUERY = '(min-width: 768px)';

const subscribe = (onChange: () => void) => {
  if (typeof window.matchMedia !== 'function') return () => undefined;
  const mql = window.matchMedia(WIDE_QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
};

// Without matchMedia (old browsers, jsdom) assume a wide viewport.
const getSnapshot = () =>
  typeof window.matchMedia !== 'function' || window.matchMedia(WIDE_QUERY).matches;

// Server/hydration snapshot: closed, so the overlay never covers the composer before the
// client knows the viewport. `useSyncExternalStore` re-renders right after hydration.
const getServerSnapshot = () => false;

/**
 * Sidebar open state. Default: open on viewports >= 768 px, closed below (the overlay would
 * cover the composer). Once the user toggles it, their choice wins over the viewport default.
 */
export function useSidebarOpen(): { isOpen: boolean; setOpen: (open: boolean) => void; toggle: () => void } {
  const isWide = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [override, setOverride] = useState<boolean | null>(null);
  const isOpen = override ?? isWide;
  const toggle = useCallback(() => setOverride(!isOpen), [isOpen]);
  return { isOpen, setOpen: setOverride, toggle };
}
