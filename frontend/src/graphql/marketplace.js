// src/graphql/marketplace.js

import { gql } from '@apollo/client';

export const LISTINGS_QUERY = gql`
  query Listings(
    $type: ListingType
    $status: ListingStatus
    $condition: String
    $variation: String
    $sort: String
    $minPrice: Float
    $maxPrice: Float
    $limit: Int
    $offset: Int
  ) {
    listings(
      type: $type
      status: $status
      condition: $condition
      variation: $variation
      sort: $sort
      minPrice: $minPrice
      maxPrice: $maxPrice
      limit: $limit
      offset: $offset
    ) {
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
        description
        allowOffers
        willTrade
        moderationResult
        proofCode
        proofImageUrl
        pendingOfferCount
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

export const CREATE_ORDER_MUTATION = CREATE_ORDER_FROM_LISTING_MUTATION;

export const CREATE_OFFER_MUTATION = gql`
  mutation CreateOffer($listingId: ID!, $amount: Float!, $message: String) {
    createOffer(listingId: $listingId, amount: $amount, message: $message) {
      id amount status createdAt
    }
  }
`;

export const PRICE_SUGGESTION_QUERY = gql`
  query PriceSuggestion($cardId: String!) {
    listings(type: CARD, status: ACTIVE, cardId: $cardId, limit: 30) {
      price
      condition
    }
  }
`;

export const CREATE_LISTING_MUTATION = gql`
  mutation CreateListing($input: CreateListingInput!) {
    createListing(input: $input) {
      id
      cardId
      price
      currency
      condition
      variation
      status
      createdAt
    }
  }
`;

export const CREATE_BULK_LISTINGS = gql`
  mutation CreateBulkListings($listings: [BulkListingItemInput!]!) {
    createBulkListings(listings: $listings) {
      batchId
      proofCode
      proofCodeExpiresAt
      count
      listings { id cardId title status }
    }
  }
`;

// Lot sale — one listing for an entire bulk lot (tracked or random).
// Backend accepts the shape via POST /listings with listingKind set.
export const CREATE_BULK_LOT_MUTATION = gql`
  mutation CreateBulkLot($input: CreateBulkLotInput!) {
    createBulkLot(input: $input) {
      id
      listingKind
      title
      cardCount
      status
      proofCode
      proofCodeExpiresAt
      createdAt
    }
  }
`;

export const SUBMIT_BULK_PROOF = gql`
  mutation SubmitBulkProof($batchId: ID!, $image: String!) {
    submitBulkProof(batchId: $batchId, image: $image) {
      ok
      result
      activated
      newProofCode
    }
  }
`;

export const MARKETPLACE_RULES_QUERY = gql`
  query MarketplaceRules {
    marketplaceRules
  }
`;

export const AGREE_TO_MARKETPLACE_RULES_MUTATION = gql`
  mutation AgreeToMarketplaceRules {
    agreeToMarketplaceRules
  }
`;

export const HAS_AGREED_QUERY = gql`
  query HasAgreedToMarketplaceRules {
    hasAgreedToMarketplaceRules
  }
`;

export const GET_LISTING_BY_ID = gql`
  query GetListingById($id: ID!) {
    listing(id: $id) {
      __typename id type price currency quantity allowOffers status createdAt updatedAt
      ... on CardListing {
        cardId condition variation allowOffers willTrade
        moderationResult proofCode proofImageUrl pendingOfferCount
        seller { id username avatar }
        cardInfo { id name number rarity setName imageSmall imageLarge }
      }
    }
  }
`;

export const ORDER_QUERY = gql`
  query Order($id: ID!) {
    order(id: $id) {
      id
      orderNumber
      status
      total
      currency
      listingId
      paymentMethod
      buyerEmail
      guestCheckout
      createdAt
      paidAt
    }
  }
`;
