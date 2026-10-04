'use client';

import { useCallback, useEffect, useRef, type UIEvent } from 'react';

/** Distance from the bottom (px) under which new content keeps the list pinned. */
const NEAR_BOTTOM_PX = 120;

/**
 * Keeps a scroll container pinned to the bottom when `dependency` changes,
 * unless the user scrolled up.
 */
export function useAutoScroll(dependency: unknown) {
  const endRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = useRef(true);

  useEffect(() => {
    if (shouldAutoScrollRef.current && endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'auto', block: 'end' });
    }
  }, [dependency]);

  const onScroll = useCallback((e: UIEvent<HTMLElement>) => {
    const target = e.currentTarget;
    shouldAutoScrollRef.current = target.scrollHeight - target.scrollTop - target.clientHeight < NEAR_BOTTOM_PX;
  }, []);

  return { endRef, onScroll };
}
