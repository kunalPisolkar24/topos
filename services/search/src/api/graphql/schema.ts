import { gql } from 'graphql-tag';

export const typeDefs = gql`
  extend schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key", "@shareable"])

  type Post @key(fields: "id") {
    id: ID!
    title: String
    summary: String
    slug: String
    authorName: String
    createdAt: String
  }

  type SearchResult @shareable {
    hits: [Post!]!
    total: Int!
  }

  type Query {
    searchPosts(query: String!, page: Int = 1, limit: Int = 10): SearchResult!
  }
`;