import type { FieldPolicy } from "@apollo/client";
import { InMemoryCache } from "@apollo/client";

interface PaginatedPosts {
  __typename?: "PaginatedPosts";
  posts: Array<{ __ref?: string; id?: string | number } & Record<string, unknown>>;
  totalPages: number;
  currentPage: number;
  totalPosts: number;
}

const paginatedPostListKeyArgs = (args: Record<string, unknown> | null) => {
  if (!args) return "";
  const page = args.page ?? 1;
  const limit = args.limit ?? "";
  const tag = args.tag ?? "";
  return `tag:${String(tag)}|page:${String(page)}|limit:${String(limit)}`;
};

const mergePaginatedPostLists = (
  existing: unknown,
  incoming: unknown,
  { args }: { args: Record<string, unknown> | null },
) => {
  if (!incoming) return existing;
  if (!existing) return incoming;

  const existingList = (existing as PaginatedPosts).posts;
  const incomingList = (incoming as PaginatedPosts).posts;
  if (!Array.isArray(existingList) || !Array.isArray(incomingList)) {
    return incoming;
  }

  const incomingPage = Number(args?.page ?? 1);
  if (incomingPage <= 1) {
    return incoming;
  }

  const seen = new Set<string>(
    existingList.map((p) =>
      typeof p.id !== "undefined" ? String(p.id) : (p.__ref ?? JSON.stringify(p)),
    ),
  );
  const dedupedIncoming = incomingList.filter((p) => {
    const key =
      typeof p.id !== "undefined" ? String(p.id) : (p.__ref ?? JSON.stringify(p));
    return !seen.has(key);
  });

  return {
    ...(incoming as PaginatedPosts),
    posts: [...existingList, ...dedupedIncoming],
  };
};

const paginatedPostListPolicy = (): FieldPolicy => ({
  keyArgs: paginatedPostListKeyArgs,
  merge: mergePaginatedPostLists,
});

const buildPostFieldPolicy = (): FieldPolicy => ({
  keyArgs: ["id"],
  merge: false,
});

export const buildApolloCache = () => {
  return new InMemoryCache({
    typePolicies: {
      Post: {
        keyFields: ["id"],
      },
      Tag: {
        keyFields: ["id"],
      },
      SearchResult: {
        keyFields: false,
      },
      User: {
        keyFields: ["id"],
        fields: {
          posts: {
            keyArgs: ["page", "limit"],
            merge: mergePaginatedPostLists,
          },
        },
      },
      Query: {
        fields: {
          me: { merge: false },
          post: buildPostFieldPolicy(),
          posts: paginatedPostListPolicy(),
          postsByTag: paginatedPostListPolicy(),
          searchPosts: {
            keyArgs: ["query", ["page"], ["limit"]],
            merge: false,
          },
          tags: {
            keyArgs: ["query", "limit"],
            merge: false,
          },
        },
      },
    },
  });
};
