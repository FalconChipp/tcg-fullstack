import { gql } from 'graphql-tag';

export default gql`
  type Trade {
    id: ID!
    status: String!
    partyAId: ID!
    partyBId: ID!
    initiatorId: ID!
    addressA: String
    addressB: String
    shippingMethodA: String
    shippingMethodB: String
    trackingNumberA: String
    trackingNumberB: String
    valueA: Float
    valueB: Float
    lockedAt: String
    completedAt: String
    cancelledAt: String
    disputeId: ID
    adminNotes: String
    createdAt: String
    updatedAt: String
    cards: [TradeCard!]
    proofs: [TradeProof!]
    disputes: [TradeDispute!]
    partyA: User
    partyB: User
    initiator: User
  }

  type TradeCard {
    id: ID!
    tradeId: ID!
    userId: ID!
    cardId: String!
    quantity: Int!
    condition: String
    notes: String
    offeredOrWanted: String!
    createdAt: String
    updatedAt: String
    card: Card
    user: User
  }

  type TradeProof {
    id: ID!
    tradeId: ID!
    userId: ID!
    proofImage: String
    proofCode: String
    uploadedAt: String
    moderatedAt: String
    moderationResult: String
    createdAt: String
    updatedAt: String
    user: User
  }

  type TradeDispute {
    id: ID!
    tradeId: ID!
    raisedById: ID!
    status: String!
    reason: String
    resolution: String
    createdAt: String
    updatedAt: String
    raisedBy: User
  }

  type TradePage {
    trades: [Trade!]!
    total: Int!
    page: Int!
    pageSize: Int!
  }

  input TradeCardInput {
    cardId: String!
    quantity: Int!
    condition: String
    notes: String
  }

  extend type Query {
    myTrades(status: String, page: Int, pageSize: Int): TradePage!
    trade(id: ID!): Trade
    browseTrades(filter: JSON, page: Int, pageSize: Int): TradePage!
    tradeDisputes(status: String, page: Int, pageSize: Int): [TradeDispute!]!
    tradeProof(tradeId: ID!, userId: ID!): TradeProof
  }

  extend type Mutation {
    initiateTrade(userId: ID!, offeredCards: [TradeCardInput!], wantedCards: [TradeCardInput!], message: String): Trade!
    respondToTrade(tradeId: ID!, accept: Boolean!, counterOffer: [TradeCardInput!]): Trade!
    lockTrade(tradeId: ID!): Trade!
    uploadTradeProof(tradeId: ID!, proofImage: String!, proofCode: String!): TradeProof!
    submitTracking(tradeId: ID!, trackingNumber: String!): Trade!
    confirmReceived(tradeId: ID!): Trade!
    raiseTradeDispute(tradeId: ID!, reason: String!): TradeDispute!
    adminResolveTradeDispute(tradeId: ID!, resolution: String!): TradeDispute!
    blockUserFromTrade(userId: ID!): Boolean!
    leaveTradeFeedback(tradeId: ID!, rating: Int!, review: String): Boolean!
  }
`;
