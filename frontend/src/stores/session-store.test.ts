import { sessionStoreActions, useSessionStore } from "./session-store";

describe("session store", () => {
  it("hydrates to anonymous when storage is empty", () => {
    expect(sessionStoreActions.initializeFromStorage()).toBeNull();
    expect(useSessionStore.getState()).toEqual({
      token: null,
      status: "anonymous",
      hasHydrated: true,
    });
  });

  it("marks the session as authenticated and persists the token", () => {
    sessionStoreActions.markAuthenticated("test-token");

    expect(useSessionStore.getState()).toEqual({
      token: "test-token",
      status: "authenticated",
      hasHydrated: true,
    });
  });

  it("clears the session back to anonymous", () => {
    sessionStoreActions.markAuthenticated("test-token");
    sessionStoreActions.markAnonymous();

    expect(useSessionStore.getState()).toEqual({
      token: null,
      status: "anonymous",
      hasHydrated: true,
    });
  });
});
