import { gql } from "graphql-tag";

export default gql`

  enum WishlistStatus {
    ACTIVE
    GRAIL
    EVENTUAL
    UPGRADE
  }

  type Listing {
    id: ID!
    userId: ID!
    price: Float!
    currency: String!
    condition: String
    variation: String
    notes: String
    status: String
    createdAt: String
  }

  type WishlistEntry {
    id: ID!
    userId: ID!
    cardId: String!
    variation: String
    quantity: Int
    notes: String
    addedAt: String
    movedToCollectionAt: String
    createdAt: String
    updatedAt: String

    card: CardsearchCard
    marketplaceListings: [Listing!]!
    forTradeUsers: [User!]!

    status: WishlistStatus!
  }

  type WishlistPage {
    entries: [WishlistEntry!]!
    total: Int!
    page: Int!
    pageSize: Int!
  }

  extend type Query {
    myWishlist(page: Int, pageSize: Int): WishlistPage!
    wishlist(userId: ID!, page: Int, pageSize: Int): WishlistPage!
    wishlistEntry(cardId: String!, variation: String): WishlistEntry
  }

  extend type Mutation {
    addToWishlist(
      cardId: String!
      quantity: Int
      condition: String
      variation: String
      notes: String
      status: WishlistStatus
    ): WishlistEntry!

    removeFromWishlist(cardId: String!, variation: String): Boolean!

    updateWishlistEntry(
      cardId: String!
      variation: String
      quantity: Int
      condition: String
      notes: String
      status: WishlistStatus
    ): WishlistEntry!

    # moveToCollection mutation is defined in the collection module

    adminAddToWishlist(
      userId: ID!
      cardId: String!
      quantity: Int
      condition: String
      variation: String
      notes: String
      status: WishlistStatus
    ): WishlistEntry!

    adminRemoveFromWishlist(userId: ID!, cardId: String!, variation: String): Boolean!
    adminClearWishlist(userId: ID!): Boolean!

    adminUpdateWishlistEntry(
      userId: ID!
      cardId: String!
      variation: String
      quantity: Int
      condition: String
      notes: String
      status: WishlistStatus
    ): WishlistEntry!
  }
`;
