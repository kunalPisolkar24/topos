import type { FieldPolicy } from "@apollo/client";
import { InMemoryCache } from "@apollo/client";
import { beforeAll, describe, expect, it } from "vitest";
import { buildApolloCache } from "./policies";

const buildList = (page: number, ids: Array<string | number>) => ({
  __typename: "PaginatedPosts",
  posts: ids.map((id) => ({ __ref: `Post:${id}`, id })),
  totalPages: 5,
  currentPage: page,
  totalPosts: 50,
});

const runMerge = (
  policy: FieldPolicy,
  existing: unknown,
  incoming: unknown,
  args: Record<string, unknown>,
) => {
  const mergeFn = policy.merge as (
    existing: unknown,
    incoming: unknown,
    ctx: { args: Record<string, unknown> | null },
  ) => unknown;
  return mergeFn(existing, incoming, { args });
};

describe("paginated post list merge policy", () => {
  let policy: FieldPolicy;

  beforeAll(() => {
    const cache = buildApolloCache();
    const policies = (
      cache as unknown as { config: { typePolicies: { Query?: { fields?: Record<string, FieldPolicy> } } } }
    ).config.typePolicies;
    const next = policies.Query?.fields?.posts;
    if (!next) throw new Error("posts policy missing");
    policy = next;
  });

  it("replaces the list on page 1", () => {
    const merged = runMerge(
      policy,
      buildList(1, ["a", "b"]),
      buildList(1, ["c"]),
      { page: 1, limit: 2 },
    );
    expect(merged).toEqual(buildList(1, ["c"]));
  });

  it("appends deduped items on subsequent pages", () => {
    const merged = runMerge(
      policy,
      buildList(1, ["a", "b"]),
      buildList(2, ["b", "c"]),
      { page: 2, limit: 2 },
    );
    const list = (merged as { posts: Array<{ id: string }> }).posts;
    expect(list.map((p) => p.id)).toEqual(["a", "b", "c"]);
  });

  it("preserves incoming when there is no existing data", () => {
    const merged = runMerge(policy, undefined, buildList(2, ["x"]), {
      page: 2,
      limit: 2,
    });
    expect(merged).toEqual(buildList(2, ["x"]));
  });

  it("preserves existing when there is no incoming data", () => {
    const merged = runMerge(policy, buildList(1, ["a"]), undefined, {
      page: 1,
      limit: 2,
    });
    expect(merged).toEqual(buildList(1, ["a"]));
  });
});

describe("buildApolloCache", () => {
  it("constructs an InMemoryCache", () => {
    const cache = buildApolloCache();
    expect(cache).toBeInstanceOf(InMemoryCache);
  });
});
