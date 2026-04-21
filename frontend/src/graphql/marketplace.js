// src/graphql/marketplace.js
// Typed documents from the shared api-client package.
// NOTE: CREATE_ORDER_MUTATION uses the legacy `createOrder` resolver which is
// not yet in the api-client package, so it stays as a local gql document.

import { gql } from '@apollo/client';

export {
  ListingsDocument as LISTINGS_QUERY,
  CreateOrderFromListingDocument as CREATE_ORDER_FROM_LISTING_MUTATION,
} from '@sixbyfive/api-client';

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
