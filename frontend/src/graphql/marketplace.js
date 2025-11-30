// frontend/graphql/marketplace.js

import { gql } from "@apollo/client";

export const LISTINGS_QUERY = gql`
  query Listings($type: ListingType, $status: ListingStatus, $limit: Int, $offset: Int) {
    listings(type: $type, status: $status, limit: $limit, offset: $offset) {
      __typename
      id
      type
      price
      currency
      quantity
      allowOffers
      status
      createdAt
      updatedAt

      ... on CardListing {
        cardId
        condition
        variation
        notes
        seller { id displayName username }
      }

      ... on ProductListing {
        title
        description
        imageUrl
        inventory { id onHand reserved sold }
        seller { id displayName username }
      }
    }
  }
`;

export const CREATE_ORDER_MUTATION = gql`
  mutation CreateOrder($input: OrderInput!) {
    createOrder(input: $input) {
      order {
        id
        orderNumber
        status
        total
        currency
        listingId
        paymentMethod
      }
      checkoutUrl
    }
  }
`;

export const CREATE_ORDER_FROM_LISTING_MUTATION = gql`
  mutation CreateOrderFromListing($input: CreateOrderFromListingInput!) {
    createOrderFromListing(input: $input) {
      id
      orderNumber
      status
      total
      currency
      guestCheckout
      buyerEmail
      buyerName

      listing {
        __typename
        id
        ... on CardListing {
          cardId
          condition
          variation
        }
        ... on ProductListing {
          title
          description
        }
      }

      createdAt
    }
  }
`;
