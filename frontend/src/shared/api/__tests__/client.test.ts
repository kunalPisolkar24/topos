import { describe, it, expect, vi, afterEach } from "vitest";
import { gql } from "@apollo/client";
import { createApolloClient } from "../client";

const networkQuery = gql`
  query ForceNetwork {
    __typename
    posts {
      id
    }
  }
`;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createApolloClient", () => {
  it("creates an ApolloClient instance", () => {
    const client = createApolloClient({
      uri: "http://localhost:4000/graphql",
      getToken: () => null,
      onUnauthorized: async () => {},
    });
    expect(client).toBeDefined();
    expect(client.link).toBeDefined();
  });

  it("calls onUnauthorized for GraphQL unauthorized errors", () => {
    const onUnauthorized = vi.fn();
    const client = createApolloClient({
      uri: "http://localhost:4000/graphql",
      getToken: () => "token",
      onUnauthorized,
    });
    expect(client).toBeDefined();
  });

  it("does not retry on 401 HTTP response", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(null, { status: 401, statusText: "Unauthorized" }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const client = createApolloClient({
      uri: "http://localhost:4000/graphql",
      getToken: () => "token",
      onUnauthorized: async () => {},
    });

    await expect(
      client.query({ query: networkQuery }),
    ).rejects.toThrow();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("does not retry on 403 HTTP response", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(null, { status: 403, statusText: "Forbidden" }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const client = createApolloClient({
      uri: "http://localhost:4000/graphql",
      getToken: () => "token",
      onUnauthorized: async () => {},
    });

    await expect(
      client.query({ query: networkQuery }),
    ).rejects.toThrow();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("retries on transient network errors", async () => {
    const fetchSpy = vi
      .fn()
      .mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchSpy);

    const client = createApolloClient({
      uri: "http://localhost:4000/graphql",
      getToken: () => null,
      onUnauthorized: async () => {},
    });

    await expect(
      client.query({ query: networkQuery }),
    ).rejects.toThrow();

    expect(fetchSpy.mock.calls.length).toBeGreaterThan(1);
  }, 15000);

  it("retries up to max attempts then gives up", async () => {
    const fetchSpy = vi
      .fn()
      .mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchSpy);

    const client = createApolloClient({
      uri: "http://localhost:4000/graphql",
      getToken: () => null,
      onUnauthorized: async () => {},
    });

    await expect(
      client.query({ query: networkQuery }),
    ).rejects.toThrow();

    expect(fetchSpy.mock.calls.length).toBe(3);
  }, 15000);

  it("retries on 5xx server errors", async () => {
    let callCount = 0;
    const fetchSpy = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount <= 2) {
        return Promise.reject(new TypeError("Failed to fetch"));
      }
      return Promise.resolve(
        new Response(null, { status: 500, statusText: "Internal Server Error" }),
      );
    });
    vi.stubGlobal("fetch", fetchSpy);

    const client = createApolloClient({
      uri: "http://localhost:4000/graphql",
      getToken: () => null,
      onUnauthorized: async () => {},
    });

    await expect(
      client.query({ query: networkQuery }),
    ).rejects.toThrow();

    expect(fetchSpy.mock.calls.length).toBe(3);
  }, 15000);
});
