import { gql } from '@apollo/client';

export const MY_TRADES_QUERY = gql`
  query MyTrades($status: TradeStatus) {
    myTrades(pageSize: 100, status: $status) {
      id status initiatorId partyAId partyBId lastCounterBy counterCount
      topUpAmount topUpPaidBy addressASet addressBSet
      trackingNumberA trackingNumberB
      createdAt updatedAt agreedAt completedAt cancelledAt cancelledReason
      cards { id tradeId userId cardId quantity condition variation }
    }
  }
`;

export const MY_WALLET_QUERY = gql`
  query MyWalletForTrade {
    myWallet(limit: 1) {
      balance
      held
      currency
    }
  }
`;

export const INITIATE_TRADE_MUTATION = gql`
  mutation InitiateTrade(
    $userId: ID!
    $offeredCards: [TradeCardInput!]
    $wantedCards: [TradeCardInput!]
    $topUpAmount: Float
  ) {
    initiateTrade(
      userId: $userId
      offeredCards: $offeredCards
      wantedCards: $wantedCards
      topUpAmount: $topUpAmount
    ) {
      id status createdAt
    }
  }
`;

export const RESPOND_TO_TRADE = gql`
  mutation RespondToTrade($id: ID!, $accept: Boolean!, $counterCards: [TradeCardInput!], $reason: String) {
    respondToTrade(id: $id, accept: $accept, counterCards: $counterCards, reason: $reason) {
      id status
    }
  }
`;

export const CANCEL_TRADE = gql`
  mutation CancelTrade($id: ID!, $reason: String) {
    cancelTrade(id: $id, reason: $reason) {
      id status
    }
  }
`;

export const UPLOAD_TRADE_PROOF = gql`
  mutation UploadTradeProof($id: ID!, $proofImage: String!, $proofCode: String) {
    uploadTradeProof(id: $id, proofImage: $proofImage, proofCode: $proofCode) {
      trade { id status }
    }
  }
`;

export const SUBMIT_TRADE_TRACKING = gql`
  mutation SubmitTradeTracking($id: ID!, $trackingNumber: String!) {
    submitTradeTracking(id: $id, trackingNumber: $trackingNumber) {
      id status
    }
  }
`;

export const SET_TRADE_ADDRESS = gql`
  mutation SetTradeShippingAddress($id: ID!, $address: JSON!) {
    setTradeShippingAddress(id: $id, address: $address)
  }
`;

export const QUOTE_TRADE_SHIPPING = gql`
  query QuoteTradeShipping($id: ID!) {
    quoteTradeShipping(id: $id) {
      amountPence amount currency carrier service
    }
  }
`;

export const SHIP_TRADE = gql`
  mutation ShipTrade($id: ID!, $parcelSize: String) {
    shipTrade(id: $id, parcelSize: $parcelSize) {
      ok trackingNumber trackingUrl labelUrl carrier service labelCost labelCostPence
    }
  }
`;

export const CONFIRM_TRADE_RECEIVED = gql`
  mutation ConfirmTradeReceived($id: ID!) {
    confirmTradeReceived(id: $id) {
      id status completedAt
    }
  }
`;
