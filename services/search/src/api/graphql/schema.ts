import { gql } from 'graphql-tag';

export const typeDefs = gql`
  extend schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key", "@shareable"])

  type Post @key(fields: "id", resolvable: false) {
    id: ID!
  }

  type SearchResult @shareable {
    hits: [Post!]!
    total: Int!
  }

  type Query {
    searchPosts(query: String!, page: Int = 1, limit: Int = 10): SearchResult!
  }
`;
