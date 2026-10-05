import { act } from '@testing-library/react';
import { vi } from 'vitest';

interface Instance {
  callback: IntersectionObserverCallback;
  targets: Set<Element>;
  disconnected: boolean;
}

/**
 * Controllable IntersectionObserver stub. jsdom has none; the lazy thumbnails stay "idle"
 * until an intersection is triggered explicitly with `intersect()`.
 * Not installed globally: call `installIntersectionObserver()` in the tests that need it
 * and `restore()` in afterEach.
 */
export function installIntersectionObserver() {
  const instances: Instance[] = [];
  class StubObserver {
    private readonly inst: Instance;
    constructor(callback: IntersectionObserverCallback) {
      this.inst = { callback, targets: new Set(), disconnected: false };
      instances.push(this.inst);
    }
    observe = (el: Element) => void this.inst.targets.add(el);
    unobserve = (el: Element) => void this.inst.targets.delete(el);
    disconnect = () => {
      this.inst.disconnected = true;
      this.inst.targets.clear();
    };
    takeRecords = () => [];
  }
  vi.stubGlobal('IntersectionObserver', StubObserver);

  const entry = (target: Element, isIntersecting: boolean) =>
    ({ target, isIntersecting, intersectionRatio: isIntersecting ? 1 : 0 }) as IntersectionObserverEntry;

  return {
    /** Number of live (not disconnected) observers. */
    liveCount: () => instances.filter((i) => !i.disconnected).length,
    /** Triggers an intersection for the given element (or for every observed element). */
    intersect(element?: Element) {
      act(() => {
        for (const inst of instances) {
          if (inst.disconnected) continue;
          for (const target of [...inst.targets]) {
            if (!element || target === element) inst.callback([entry(target, true)], inst as unknown as IntersectionObserver);
          }
        }
      });
    },
    restore: () => vi.unstubAllGlobals(),
  };
}
