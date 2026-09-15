export interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear?(): void;
  key?(index: number): string | null;
  readonly length?: number;
}

export const createMemoryStorage = (): StoragePort & { clear: () => void; length: number; key: (index: number) => string | null } => {
  const store = new Map<string, string>();
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => { store.set(key, value); },
    removeItem: (key) => { store.delete(key); },
    clear: () => store.clear(),
    get length() { return store.size; },
    key: (index) => Array.from(store.keys())[index] ?? null,
  };
};

export const browserSessionStorage: StoragePort = {
  getItem: (key) => {
    try { return sessionStorage.getItem(key); } catch { return null; }
  },
  setItem: (key, value) => {
    try { sessionStorage.setItem(key, value); } catch { void 0; }
  },
  removeItem: (key) => {
    try { sessionStorage.removeItem(key); } catch { void 0; }
  },
  clear: () => {
    try { sessionStorage.clear(); } catch { void 0; }
  },
  key: (index) => {
    try { return sessionStorage.key(index); } catch { return null; }
  },
  get length() {
    try { return sessionStorage.length; } catch { return 0; }
  },
};

export const browserLocalStorage: StoragePort = {
  getItem: (key) => {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  setItem: (key, value) => {
    try { localStorage.setItem(key, value); } catch { void 0; }
  },
  removeItem: (key) => {
    try { localStorage.removeItem(key); } catch { void 0; }
  },
  clear: () => {
    try { localStorage.clear(); } catch { void 0; }
  },
  key: (index) => {
    try { return localStorage.key(index); } catch { return null; }
  },
  get length() {
    try { return localStorage.length; } catch { return 0; }
  },
};
