import { CombinedGraphQLErrors } from "@apollo/client/errors";
import { describe, expect, it } from "vitest";
import { getGraphQLErrorCodes, getGraphQLErrorMessage } from "../graphql-error";

describe("getGraphQLErrorMessage", () => {
  it("returns a combined message from a GraphQL error", () => {
    const combined = new CombinedGraphQLErrors({
      errors: [{ message: "Field failed" }, { message: "Other failure" }],
      data: undefined,
    });

    expect(getGraphQLErrorMessage(combined, "fallback")).toBe(
      "Field failed Other failure",
    );
  });

  it("falls back when GraphQL error has no messages", () => {
    const combined = new CombinedGraphQLErrors({
      errors: [{ message: "   " }],
      data: undefined,
    });
    expect(getGraphQLErrorMessage(combined, "fallback message")).toBe(
      "fallback message",
    );
  });

  it("returns message from a plain Error", () => {
    expect(getGraphQLErrorMessage(new Error("boom"), "fallback")).toBe("boom");
  });

  it("returns message from an object with a string message", () => {
    expect(getGraphQLErrorMessage({ message: "thing went wrong" }, "fb")).toBe(
      "thing went wrong",
    );
  });

  it("returns fallback when nothing usable is present", () => {
    expect(getGraphQLErrorMessage(undefined, "default")).toBe("default");
    expect(getGraphQLErrorMessage({}, "default")).toBe("default");
    expect(getGraphQLErrorMessage({ message: "" }, "default")).toBe("default");
  });
});

describe("getGraphQLErrorCodes", () => {
  it("returns codes from a combined GraphQL error", () => {
    const combined = new CombinedGraphQLErrors({
      errors: [
        { message: "taken", extensions: { code: "USER_ALREADY_EXISTS" } },
        { message: "other" },
      ],
      data: undefined,
    });

    expect(getGraphQLErrorCodes(combined)).toEqual(["USER_ALREADY_EXISTS"]);
  });

  it("returns empty array when no codes are present", () => {
    expect(getGraphQLErrorCodes(new Error("boom"))).toEqual([]);
    expect(getGraphQLErrorCodes(undefined)).toEqual([]);
  });
});
