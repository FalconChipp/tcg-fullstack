// src/modules/userProfiles/typeDefs.js
const gql = require('graphql-tag');

module.exports = gql`
  type User {
    id: ID!
    email: String!
    username: String!
    avatarUrl: String
    isVerified: Boolean!
    createdAt: String
    updatedAt: String
    # Add more public profile fields as needed
  }

  type Query {
    userProfile(id: ID, username: String): User
    searchUsers(query: String!, limit: Int = 10): [User!]!
  }

  type Mutation {
    updateProfile(username: String, avatarUrl: String): User!
  }
`;
