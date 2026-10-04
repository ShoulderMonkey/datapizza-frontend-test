import { vi } from 'vitest';

/**
 * In-memory localStorage with spy-able methods. Node >= 25 exposes a global `localStorage`
 * that shadows jsdom's and is unusable without --localstorage-file, so tests install this stub.
 */
export function installMemoryLocalStorage() {
  const store = new Map<string, string>();
  const storage = {
    getItem: vi.fn((k: string) => (store.has(k) ? store.get(k)! : null)),
    setItem: vi.fn((k: string, v: string) => void store.set(k, String(v))),
    removeItem: vi.fn((k: string) => void store.delete(k)),
    clear: vi.fn(() => store.clear()),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  };
  vi.stubGlobal('localStorage', storage);
  return storage;
}
