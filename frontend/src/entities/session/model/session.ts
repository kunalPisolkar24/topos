import { browserLocalStorage, type StoragePort } from "@/shared/lib/storage";

export type AuthStatus = "anonymous" | "hydrating" | "authenticated";

export interface SessionSnapshot {
  token: string | null;
  status: AuthStatus;
  hasHydrated: boolean;
}

export const initialSessionState: SessionSnapshot = {
  token: null,
  status: "hydrating",
  hasHydrated: false,
};

export const SESSION_TOKEN_STORAGE_KEY = "jwt";

export interface SessionStorageAdapter {
  load(): string | null;
  save(token: string): void;
  clear(): void;
}

export const createSessionAdapter = (
  storage: StoragePort = browserLocalStorage,
): SessionStorageAdapter => ({
  load() {
    if (typeof window === "undefined") {
      return null;
    }
    return storage.getItem(SESSION_TOKEN_STORAGE_KEY);
  },
  save(token) {
    if (typeof window === "undefined") {
      return;
    }
    storage.setItem(SESSION_TOKEN_STORAGE_KEY, token);
  },
  clear() {
    if (typeof window === "undefined") {
      return;
    }
    storage.removeItem(SESSION_TOKEN_STORAGE_KEY);
  },
});

export const localStorageSessionAdapter: SessionStorageAdapter =
  createSessionAdapter();
