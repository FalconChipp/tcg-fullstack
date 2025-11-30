// src/modules/collections/typeDefs.js

import { gql } from 'graphql-tag';

const typeDefs = gql`
  type Collection {
    id: ID!
    userId: ID!
    cardId: String!
    quantity: Int!
    condition: String
    variation: String
    wishlist: Boolean!
    createdAt: String
    updatedAt: String
    card: CardsearchCard
  }

  type AdminUserCollectionSummary {
    userId: ID!
    username: String! 
    email: String! 
    totalCards: Int! 
    distinctCards: Int! 
  }

  extend type Query {
    myCollection: [Collection!]!
    collection(userId: ID!): [Collection!]!
    collectionEntry(cardId: String!, variation: String): Collection

    adminUserCollections(limit: Int, search: String) : [AdminUserCollectionSummary!]!
  }

  extend type Mutation {
    addToCollection(
      cardId: String!
      quantity: Int
      condition: String
      variation: String
    ): Collection!

    removeFromCollection(cardId: String!, variation: String): Boolean!

    updateCollectionEntry(
      cardId: String!
      quantity: Int
      condition: String
      variation: String
    ): Collection!

    moveToWishlist(cardId: String!, variation: String): Collection!
    moveToCollection(cardId: String!, variation: String): Collection!
  }
`;

export default typeDefs;
