// src/modules/search/typeDefs.js (ESM)
import { gql } from 'graphql-tag';

export const typeDefs = gql`
  scalar JSON

  type Price {
    low: Float
    mid: Float
    high: Float
    market: Float
    directLow: Float

    averageSellPrice: Float
    lowPrice: Float
    trendPrice: Float

    reverseHoloSell: Float
    reverseHoloLow: Float
    reverseHoloTrend: Float
  }

  type Card {
    id: ID!
    name: String
    number: String
    set: String
    setName: String
    setLogo: String
    setSymbol: String
    edition: String
    image: String
    rarity: String
    variations: [String!]
    pricing: JSON
    tcgplayerVariations: JSON
    cardmarketVariations: JSON
    tcgplayerLow: Float
    tcgplayerMid: Float
    tcgplayerHigh: Float
    tcgplayerMarket: Float
    tcgplayerDirectLow: Float
    cardmarketAverageSell: Float
    cardmarketLowPrice: Float
    cardmarketTrendPrice: Float
    createdAt: String
    updatedAt: String
  }

  type CardEdge {
    cursor: String!
    node: Card!
  }

  type CardConnection {
    edges: [CardEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type PageInfo {
    hasNextPage: Boolean!
    endCursor: String
  }

  input SearchCardsInput {
    name: String
    set: String
    number: String
    listed: Boolean
    forTrade: Boolean
    rarity: String
    first: Int = 25
    after: String
    budget: Int = 8
    trustUpstream: Boolean = false
  }

  type Query {
    searchCards(input: SearchCardsInput!): CardConnection!
    card(id: ID!): Card
  }
`;

export default typeDefs;
