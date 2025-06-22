// src/modules/binders/typeDefs.js
const gql = require('graphql-tag');

module.exports = gql`
  type Binder {
    id: ID!
    name: String!
    description: String
    userId: ID!
    createdAt: String
    updatedAt: String
    cards: [Collection!] # Cards in this binder (Collection links card+quantity)
  }

  type Query {
    binders(userId: ID): [Binder!]!
    binder(id: ID!): Binder
  }

  type Mutation {
    createBinder(name: String!, description: String): Binder!
    updateBinder(id: ID!, name: String, description: String): Binder!
    deleteBinder(id: ID!): Boolean!
  }
`;
