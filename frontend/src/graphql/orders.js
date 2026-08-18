// Plain-string GraphQL for gqlFetch (account tabs + checkout).
// These are NOT gql-tagged because they're used with gqlFetch, not Apollo client.

export const MY_ORDERS_QUERY = `
  query MyOrders($role: String, $limit: Int) {
    myOrders(role: $role, limit: $limit) {
      id orderNumber totalAmount salePrice shippingCost currency
      paymentStatus fulfilmentStatus walletAmountPence clientSecret
      trackingNumber trackingCarrier
      buyerId sellerId
      createdAt shippedAt completedAt cancelledAt
      buyer  { id username avatar }
      seller { id username avatar }
      listing {
        ... on CardListing {
          id title rating
          cardInfo { name imageSmall setName }
        }
      }
    }
  }
`;

// Superset of both OrdersTab and checkout.js versions (balance + balancePence)
export const GET_WALLET_BALANCE = `
  query MyWalletBalance {
    myWallet(limit: 0) { balancePence balance currency }
  }
`;

export const APPLY_WALLET_TO_ORDER = `
  mutation ApplyWalletToOrder($orderId: ID!, $walletAmountPence: Int!) {
    applyWalletToOrder(orderId: $orderId, walletAmountPence: $walletAmountPence) {
      ok clientSecret walletAmountPence cardTotal
    }
  }
`;

export const SHIP_ORDER = `
  mutation ShipOrder($id: ID!) {
    shipOrder(id: $id) {
      ok trackingNumber trackingUrl labelUrl labelBase64 carrier service labelCost
    }
  }
`;

export const CONFIRM_RECEIVED = `
  mutation ConfirmOrderReceived($id: ID!) {
    confirmOrderReceived(id: $id) {
      id fulfilmentStatus paymentStatus completedAt
    }
  }
`;

export const RAISE_DISPUTE = `
  mutation RaiseOrderDispute($id: ID!, $reason: String!) {
    raiseOrderDispute(id: $id, reason: $reason) {
      id fulfilmentStatus
    }
  }
`;

export const CANCEL_ORDER = `
  mutation CancelOrder($id: ID!, $reason: String) {
    cancelOrder(id: $id, reason: $reason) {
      id fulfilmentStatus paymentStatus cancelledAt
    }
  }
`;

export const LEAVE_FEEDBACK = `
  mutation LeaveOrderFeedback($id: ID!, $rating: Int!, $review: String) {
    leaveOrderFeedback(id: $id, rating: $rating, review: $review)
  }
`;

export const DISPUTE_REVIEW = `
  mutation DisputeOrderReview($id: ID!, $reason: String) {
    disputeOrderReview(id: $id, reason: $reason)
  }
`;

export const CREATE_CART_ORDERS = `
  mutation CreateCartOrders($items: [CartItemInput!]!, $walletAmountPence: Int) {
    createCartOrders(items: $items, walletAmountPence: $walletAmountPence) {
      orders { id clientSecret salePrice totalAmount currency walletAmountPence }
      errors { listingId error }
    }
  }
`;

const OFFER_FIELDS = `
  id listingId buyerId amount message status
  expiresAt respondedAt counterAmount counterMessage
  createdAt updatedAt
  buyer { id username avatar }
  listing {
    id title price cardId
    cardInfo { name imageSmall setName }
  }
`;

export const MY_INCOMING_OFFERS_QUERY = `
  query MyIncomingOffers {
    myIncomingOffers { ${OFFER_FIELDS} }
  }
`;

export const MY_OFFERS_QUERY = `
  query MyOffers {
    myOffers { ${OFFER_FIELDS} }
  }
`;

export const RESPOND_TO_OFFER = `
  mutation RespondToOffer(
    $offerId: ID!
    $action: String!
    $counterAmount: Float
    $counterMessage: String
    $buyerAddress: JSON
  ) {
    respondToOffer(
      offerId: $offerId
      action: $action
      counterAmount: $counterAmount
      counterMessage: $counterMessage
      buyerAddress: $buyerAddress
    ) {
      ok status orderId clientSecret totalAmount counterAmount
    }
  }
`;

export const WITHDRAW_OFFER = `
  mutation WithdrawOffer($offerId: ID!) {
    withdrawOffer(offerId: $offerId)
  }
`;

export const SELLER_STATUS_QUERY = `
  query SellerStatus {
    sellerStatus { connected complete url }
    myWallet(limit: 1) { balance currency }
    myCapabilities { platformFeePercent maxActiveListings }
    sellerAddress { name line1 line2 city postcode country phone email }
    myDeliveryAddress { address1 address2 city postcode state country }
  }
`;

export const UPDATE_SELLER_ADDRESS = `
  mutation UpdateSellerAddress($input: SellerAddressInput!) {
    updateSellerAddress(input: $input)
  }
`;

export const UPDATE_DELIVERY_ADDRESS = `
  mutation UpdateDeliveryAddress(
    $address1: String $address2: String $city: String $postcode: String $state: String $country: String
  ) {
    updateProfile(address1: $address1 address2: $address2 city: $city postcode: $postcode state: $state country: $country) {
      address1 address2 city postcode state country
    }
  }
`;
