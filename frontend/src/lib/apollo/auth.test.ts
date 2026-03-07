import {
  buildAuthHeaders,
  hasUnauthorizedGraphQLError,
  hasUnauthorizedNetworkError,
} from "./auth";

describe("apollo auth helpers", () => {
  it("builds bearer auth headers when a token exists", () => {
    expect(buildAuthHeaders("token-123")).toEqual({
      Authorization: "Bearer token-123",
    });
  });

  it("returns empty auth headers when no token exists", () => {
    expect(buildAuthHeaders(null)).toEqual({});
  });

  it("detects unauthorized graphql errors", () => {
    expect(
      hasUnauthorizedGraphQLError([
        { message: "Unauthorized" },
        { message: "Other error" },
      ]),
    ).toBe(true);
  });

  it("detects unauthorized network errors", () => {
    expect(hasUnauthorizedNetworkError({ statusCode: 401 })).toBe(true);
    expect(hasUnauthorizedNetworkError({ status: 403 })).toBe(true);
    expect(hasUnauthorizedNetworkError({ statusCode: 500 })).toBe(false);
  });
});
