// src/graphql/marketplace.js

import { gql } from '@apollo/client';

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
        allowOffers
        willTrade
        seller { id username avatar }
        cardInfo {
          id
          name
          number
          rarity
          setName
          imageSmall
          imageLarge
        }
      }
      ... on ProductListing {
        title
        description
        imageUrl
        imagesJson
        inventory { id onHand reserved sold }
        seller { id username avatar }
      }
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
      listingId
      paymentStatus
      clientSecret
      createdAt
    }
  }
`;
