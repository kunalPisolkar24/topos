import { useApolloClient, useQuery } from "@apollo/client/react";
import {
  TagsDocument,
  type TagsQuery,
  type TagsQueryVariables,
} from "@/shared/graphql/content-documents";
import type { Tag } from "../model/tag";

export interface SearchTagsParams {
  query: string;
  limit?: number;
  skip?: boolean;
}

export const tagRepository = {
  search({ query, limit = 6, skip }: SearchTagsParams = { query: "" }) {
    return useQuery<TagsQuery, TagsQueryVariables>(TagsDocument, {
      variables: { query, limit },
      skip: skip ?? query.length === 0,
      fetchPolicy: "cache-and-network",
      notifyOnNetworkStatusChange: true,
    });
  },

  async searchTagsOnce(
    client: ReturnType<typeof useApolloClient>,
    { query, limit = 6 }: { query: string; limit?: number },
  ): Promise<Tag[]> {
    const { data } = await client.query<TagsQuery, TagsQueryVariables>({
      query: TagsDocument,
      variables: { query, limit },
      fetchPolicy: "no-cache",
    });

    return data?.tags ?? [];
  },
};
