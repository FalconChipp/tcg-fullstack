// src/modules/collections/typeDefs.js
const gql = require('graphql-tag');

module.exports = gql`
  type Collection {
    id: ID!
    userId: ID!
    cardId: String!
    binderId: ID
    quantity: Int!
    card: Card
    binder: Binder
    createdAt: String
    updatedAt: String
  }

  type Query {
    myCollection(binderId: ID): [Collection!]!
    collection(userId: ID!): [Collection!]!
    collectionEntry(cardId: String!): Collection
  }

  type Mutation {
    addToCollection(cardId: String!, quantity: Int = 1, binderId: ID): Collection!
    updateCollectionEntry(id: ID!, quantity: Int, binderId: ID): Collection!
    removeFromCollection(id: ID!): Boolean!
  }
`;
