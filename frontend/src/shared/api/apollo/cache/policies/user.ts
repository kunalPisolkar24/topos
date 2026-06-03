import type { FieldPolicy, TypePolicy } from "@apollo/client";

import { mergePaginatedPostLists } from "./post";

export const userTypePolicy: TypePolicy = {
  keyFields: ["id"],
  fields: {
    posts: {
      keyArgs: ["page", "limit"],
      merge: mergePaginatedPostLists,
    },
  },
};

export const userQueryFieldPolicies: Record<string, FieldPolicy> = {
  me: { merge: false },
};
