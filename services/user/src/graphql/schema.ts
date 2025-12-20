import gql from 'graphql-tag';

export const typeDefs = gql`
  extend schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key"])

  type User @key(fields: "id") {
    id: ID!
    username: String!
    email: String!
    name: String
    bio: String
    avatarUrl: String
    bannerUrl: String
    createdAt: String!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type Query {
    me: User
    user(id: ID!): User
  }

  type Mutation {
    signup(email: String!, username: String!, password: String!): AuthPayload!
    signin(email: String!, password: String!): AuthPayload!
  }
`;