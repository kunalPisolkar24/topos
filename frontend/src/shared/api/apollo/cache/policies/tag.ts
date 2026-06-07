import type { FieldPolicy, TypePolicy } from "@apollo/client";

export const tagTypePolicy: TypePolicy = {
  keyFields: ["id"],
};

export const tagQueryFieldPolicies: Record<string, FieldPolicy> = {
  tags: {
    keyArgs: ["query", "limit"],
    merge: false,
  },
};
