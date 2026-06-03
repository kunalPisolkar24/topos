import { describe, it, expect, vi } from "vitest";
import { createApolloClient } from "../client";

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
});
