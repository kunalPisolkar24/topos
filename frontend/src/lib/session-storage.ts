const SESSION_TOKEN_STORAGE_KEY = "jwt";

export function loadSessionToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(SESSION_TOKEN_STORAGE_KEY);
}

export function saveSessionToken(token: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(SESSION_TOKEN_STORAGE_KEY, token);
}

export function clearSessionToken() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
}

export { SESSION_TOKEN_STORAGE_KEY };
