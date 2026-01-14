import { gql } from "@apollo/client";

// Replaces updateWishlistStatus.js
// Uses the schema-supported mutation: updateWishlistEntry
export const UPDATE_WISHLIST_ENTRY = gql`
  mutation UpdateWishlistEntry(
    $cardId: String!
    $variation: String
    $quantity: Int
    $condition: String
    $notes: String
    $status: WishlistStatus
  ) {
    updateWishlistEntry(
      cardId: $cardId
      variation: $variation
      quantity: $quantity
      condition: $condition
      notes: $notes
      status: $status
    ) {
      id
      cardId
      variation
      quantity
      notes
      status
      updatedAt
    }
  }
`;
