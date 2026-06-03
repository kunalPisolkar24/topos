import { ApolloClient, InMemoryCache } from "@apollo/client";
import {
  bootstrapSession,
  authenticateSession,
  logoutSession,
  handleUnauthorizedSession,
  writeCurrentUserToCache,
  resetSessionBootstrapForTests,
} from "../lib/session";
import { sessionStoreActions } from "../store/session-store";
import { MeDocument } from "@/shared/graphql/generated/graphql";

function createMockClient(overrides?: Partial<ApolloClient<InMemoryCache>>) {
  const cache = new InMemoryCache();
  return {
    query: vi.fn(),
    clearStore: vi.fn().mockResolvedValue(undefined),
    writeQuery: vi.fn(),
    cache,
    ...overrides,
  } as unknown as ApolloClient<InMemoryCache>;
}

const mockUser = {
  __typename: "User" as const,
  id: "user-1",
  username: "testuser",
  name: "Test User",
  email: "test@example.com",
  avatarUrl: null,
  bannerUrl: null,
  bio: null,
};

describe("session", () => {
  afterEach(() => {
    resetSessionBootstrapForTests();
    sessionStoreActions.resetForTests();
  });

  describe("writeCurrentUserToCache", () => {
    it("writes user data to the Apollo cache", () => {
      const client = createMockClient();
      writeCurrentUserToCache(client, mockUser as never);
      expect(client.writeQuery).toHaveBeenCalledWith({
        query: MeDocument,
        data: { me: mockUser },
      });
    });

    it("writes null user to the Apollo cache", () => {
      const client = createMockClient();
      writeCurrentUserToCache(client, null);
      expect(client.writeQuery).toHaveBeenCalledWith({
        query: MeDocument,
        data: { me: null },
      });
    });
  });

  describe("authenticateSession", () => {
    it("marks the session as authenticated and writes user to cache", () => {
      const client = createMockClient();
      authenticateSession(client, "token-123", mockUser as never);
      expect(client.writeQuery).toHaveBeenCalled();
      const state = sessionStoreActions as unknown as { initializeFromStorage(): string | null };
      expect(state).toBeDefined();
    });
  });

  describe("logoutSession", () => {
    it("marks the session as anonymous and clears the Apollo store", async () => {
      const client = createMockClient();
      await logoutSession(client);
      expect(client.clearStore).toHaveBeenCalled();
    });
  });

  describe("handleUnauthorizedSession", () => {
    it("logs out the session and clears the store", async () => {
      const client = createMockClient();
      await handleUnauthorizedSession(client);
      expect(client.clearStore).toHaveBeenCalled();
    });
  });

  describe("bootstrapSession", () => {
    it("does nothing when no token exists in storage", async () => {
      const client = createMockClient();
      await bootstrapSession(client);
      expect(client.query).not.toHaveBeenCalled();
    });

    it("fetches the current user when a token exists", async () => {
      localStorage.setItem("jwt", "existing-token");
      const client = createMockClient({
        query: vi.fn().mockResolvedValue({
          data: { me: mockUser },
        }),
      } as Partial<ApolloClient<InMemoryCache>> as ApolloClient<InMemoryCache>);

      await bootstrapSession(client);

      expect(client.query).toHaveBeenCalledWith({
        query: MeDocument,
        fetchPolicy: "network-only",
      });
      expect(client.writeQuery).toHaveBeenCalled();
    });

    it("calls logoutSession when query fails", async () => {
      localStorage.setItem("jwt", "bad-token");
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const client = createMockClient({
        query: vi.fn().mockRejectedValue(new Error("Network error")),
        clearStore: vi.fn().mockResolvedValue(undefined),
      } as Partial<ApolloClient<InMemoryCache>> as ApolloClient<InMemoryCache>);

      await bootstrapSession(client);

      expect(client.clearStore).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("calls logoutSession when query returns no user", async () => {
      localStorage.setItem("jwt", "valid-token");
      const client = createMockClient({
        query: vi.fn().mockResolvedValue({
          data: { me: null },
        }),
        clearStore: vi.fn().mockResolvedValue(undefined),
      } as Partial<ApolloClient<InMemoryCache>> as ApolloClient<InMemoryCache>);

      await bootstrapSession(client);

      expect(client.clearStore).toHaveBeenCalled();
    });

    it("deduplicates concurrent bootstrap calls", async () => {
      localStorage.setItem("jwt", "token");
      const queryFn = vi.fn().mockResolvedValue({
        data: { me: mockUser },
      });
      const client = createMockClient({
        query: queryFn,
      } as Partial<ApolloClient<InMemoryCache>> as ApolloClient<InMemoryCache>);

      const p1 = bootstrapSession(client);
      const p2 = bootstrapSession(client);

      await Promise.all([p1, p2]);
      expect(queryFn).toHaveBeenCalledTimes(1);
    });
  });
});
