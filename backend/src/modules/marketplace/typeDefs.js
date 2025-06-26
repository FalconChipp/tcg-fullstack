import { gql } from 'graphql-tag';

export default gql`
  type MarketplaceListing {
    id: ID!
    userId: ID!
    cardId: String!
    quantity: Int!
    price: Float!
    currency: String!
    condition: String
    variation: String
    notes: String
    status: String
    proofImage: String
    proofUploadedAt: String
    createdAt: String
    updatedAt: String
    offers: [Offer!]
    seller: User
  }

  type Offer {
    id: ID!
    listingId: ID!
    buyerId: ID!
    price: Float!
    status: String!
    createdAt: String
    updatedAt: String
    buyer: User
  }

  type ListingPage {
    listings: [MarketplaceListing!]!
    total: Int!
    page: Int!
    pageSize: Int!
  }

  input ListingInput {
    cardId: String!
    quantity: Int
    price: Float
    currency: String
    condition: String
    variation: String
    notes: String
  }

  input OfferInput {
    listingId: ID!
    price: Float!
  }

  extend type Query {
    myMarketplaceListings(page: Int, pageSize: Int): ListingPage!
    marketplaceListing(id: ID!): MarketplaceListing
    browseMarketplaceListings(page: Int, pageSize: Int, cardId: String, sellerId: ID): ListingPage!
  }

  extend type Mutation {
    generateProofCode: String!
    createMarketplaceListing(input: ListingInput!, proofCode: String!, proofImage: String!): MarketplaceListing!
    updateMarketplaceListing(id: ID!, input: ListingInput!): MarketplaceListing!
    delistMarketplaceListing(id: ID!): Boolean!
    makeOffer(input: OfferInput!): Offer!
    respondOffer(id: ID!, accept: Boolean!): Offer!
  }
`;
