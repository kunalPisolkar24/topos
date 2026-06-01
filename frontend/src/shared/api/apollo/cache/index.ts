import type { TypePolicies } from "@apollo/client";
import { InMemoryCache } from "@apollo/client";

import { postQueryFieldPolicies, postTypePolicy } from "./policies/post";
import { tagQueryFieldPolicies, tagTypePolicy } from "./policies/tag";
import { userQueryFieldPolicies, userTypePolicy } from "./policies/user";

const searchResultTypePolicy: TypePolicies[string] = {
  keyFields: false,
};

export const buildApolloCache = () => {
  return new InMemoryCache({
    typePolicies: {
      Post: postTypePolicy,
      Tag: tagTypePolicy,
      User: userTypePolicy,
      SearchResult: searchResultTypePolicy,
      Query: {
        fields: {
          ...postQueryFieldPolicies,
          ...userQueryFieldPolicies,
          ...tagQueryFieldPolicies,
        },
      },
    },
  });
};
