import { create } from "zustand";
import {
  initialSessionState,
  localStorageSessionAdapter,
  type SessionSnapshot,
} from "../model/session";

const sessionStorage = localStorageSessionAdapter;

export const useSessionStore = create<SessionSnapshot>(() => initialSessionState);

export const sessionStoreActions = {
  initializeFromStorage() {
    const token = sessionStorage.load();

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
    sessionStorage.save(token);
    useSessionStore.setState({
      token,
      status: "authenticated",
      hasHydrated: true,
    });
  },

  markAnonymous() {
    sessionStorage.clear();
    useSessionStore.setState({
      token: null,
      status: "anonymous",
      hasHydrated: true,
    });
  },

  resetForTests() {
    sessionStorage.clear();
    useSessionStore.setState(initialSessionState);
  },
};
