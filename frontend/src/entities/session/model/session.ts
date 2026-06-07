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

export const localStorageSessionAdapter: SessionStorageAdapter = {
  load() {
    if (typeof window === "undefined") {
      return null;
    }
    return window.localStorage.getItem(SESSION_TOKEN_STORAGE_KEY);
  },
  save(token) {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(SESSION_TOKEN_STORAGE_KEY, token);
  },
  clear() {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
  },
};
