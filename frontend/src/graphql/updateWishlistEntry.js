// src/graphql/updateWishlistEntry.js
import { gql } from '@apollo/client';

export const UPDATE_WISHLIST_ENTRY = gql`
  mutation UpdateWishlistEntry(
    $cardId: String!
    $variation: String
    $quantity: Int
    $notes: String
    $status: WishlistStatus
  ) {
    updateWishlistEntry(
      cardId: $cardId
      variation: $variation
      quantity: $quantity
      notes: $notes
      status: $status
    ) {
      id
      userId
      cardId
      quantity
      variation
      notes
      status
      addedAt
      createdAt
      updatedAt
      card {
        id
        cardId
        name
        number
        setCode
        rarity
        images { small large }
      }
    }
  }
`;
