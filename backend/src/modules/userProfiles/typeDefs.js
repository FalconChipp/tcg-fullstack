const gql = require('graphql-tag');

module.exports = gql`
  scalar Upload

  type User {
    id: ID!
    email: String!
    username: String!
    avatarUrl: String
    isVerified: Boolean!
    createdAt: String
    updatedAt: String
    bio: String
    favouritePokemon: String
  }

  type Query {
    userProfile(id: ID, username: String): User
    searchUsers(query: String!, limit: Int = 10): [User!]!
  }

  type Mutation {
    updateProfile(username: String, avatarUrl: String, bio: String, favouritePokemon: String): User!
    uploadAvatar(file: Upload!): User!
  }
`;
