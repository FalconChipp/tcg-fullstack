// src/modules/marketplace/typeDefs.js
const gql = require('graphql-tag');

module.exports = gql`
  type MarketplaceListing {
    id: ID!
    userId: ID!
    cardId: String!
    card: Card
    quantity: Int!
    price: Float!
    status: String!
    createdAt: String
    updatedAt: String
    seller: User
  }

  type Query {
    marketplaceListings(
      cardId: String
      status: String = "listed"
      limit: Int = 30
      offset: Int = 0
    ): [MarketplaceListing!]!
    myMarketplaceListings: [MarketplaceListing!]!
    marketplaceListing(id: ID!): MarketplaceListing
  }

  type Mutation {
    createMarketplaceListing(cardId: String!, quantity: Int!, price: Float!): MarketplaceListing!
    updateMarketplaceListing(id: ID!, quantity: Int, price: Float, status: String): MarketplaceListing!
    removeMarketplaceListing(id: ID!): Boolean!
    markMarketplaceListingSold(id: ID!): MarketplaceListing!
  }
`;
