import type { FieldPolicy, TypePolicy } from "@apollo/client";

export const paginatedPostListKeyArgs = (args: Record<string, unknown> | null): string | false => {
  if (!args) return "";
  const tag = args.tag ?? "";
  const mode = args.mode ?? "";
  const seed = args.seed ?? "";
  const query = args.query !== undefined ? `|query:${String(args.query)}` : "";
  return `tag:${String(tag)}|mode:${String(mode)}|seed:${String(seed)}|page:${String(args.page ?? 1)}|limit:${String(args.limit ?? "")}${query}`;
};

export const mergePaginatedPostLists = (existing: unknown, incoming: unknown) => {
  if (!incoming) return existing;
  return incoming;
};

const paginatedPostListPolicy = (): FieldPolicy => ({
  keyArgs: paginatedPostListKeyArgs,
  merge: mergePaginatedPostLists,
});

const postFieldPolicy = (): FieldPolicy => ({
  keyArgs: ["id"],
  merge: false,
});

export const postTypePolicy: TypePolicy = {
  keyFields: ["id"],
};

export const postQueryFieldPolicies: Record<string, FieldPolicy> = {
  post: postFieldPolicy(),
  posts: paginatedPostListPolicy(),
  postsByTag: paginatedPostListPolicy(),
  recommendedPosts: paginatedPostListPolicy(),
  searchPosts: {
    keyArgs: ["query", "page", "limit"],
    merge: false,
  },
};
