import { create } from "zustand";
import {
  clearSessionToken,
  loadSessionToken,
  saveSessionToken,
} from "@/lib/session-storage";

export type AuthStatus = "anonymous" | "hydrating" | "authenticated";

type SessionSnapshot = {
  token: string | null;
  status: AuthStatus;
  hasHydrated: boolean;
};

const initialSessionState: SessionSnapshot = {
  token: null,
  status: "hydrating",
  hasHydrated: false,
};

export const useSessionStore = create<SessionSnapshot>(() => initialSessionState);

export const sessionStoreActions = {
  initializeFromStorage() {
    const token = loadSessionToken();

    if (!token) {
      useSessionStore.setState({
        token: null,
        status: "anonymous",
        hasHydrated: true,
      });
      return null;
    }

    useSessionStore.setState({
      token,
      status: "hydrating",
      hasHydrated: false,
    });
    return token;
  },

  markAuthenticated(token: string) {
    saveSessionToken(token);
    useSessionStore.setState({
      token,
      status: "authenticated",
      hasHydrated: true,
    });
  },

  markAnonymous() {
    clearSessionToken();
    useSessionStore.setState({
      token: null,
      status: "anonymous",
      hasHydrated: true,
    });
  },

  resetForTests() {
    clearSessionToken();
    useSessionStore.setState(initialSessionState);
  },
};
