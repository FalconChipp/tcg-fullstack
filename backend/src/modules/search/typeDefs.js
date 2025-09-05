// src/modules/search/typeDefs.js
// OLD schema kept + NEW cursor connection added (plain ESM)

import { gql } from 'graphql-tag';

export default gql`
  scalar JSON

  """Existing price/variation shapes used by the legacy UI"""
  type CardPriceVariation {
    variation: String!
    gbp: Float
    tcgplayer: Float
    cardmarket: Float
    currency: String
    updatedAt: String
  }

  type CardPriceHistoryPoint {
    date: String!
    variation: String!
    gbp: Float
    tcgplayer: Float
    cardmarket: Float
  }

  type CardListing {
    id: ID!
    userId: ID!
    price: Float!
    currency: String!
    condition: String
    variation: String
    notes: String
    status: String
    createdAt: String
  }

  """Legacy Card type kept (nodes in connection will also be this Card)"""
  type Card {
    id: String!
    name: String!
    set: String!
    setName: String
    number: String!
    image: String
    rarity: String
    variations: Variants
    prices: [CardPriceVariation]
    priceHistory(days: Int = 30): [CardPriceHistoryPoint!]!
    isListed: Boolean
    listings: [CardListing]
    isForTrade: Boolean
    collectionCount: Int
    setSize: Int
    setCompletion: Float
  }

  type CardSet {
    code: String!
    name: String!
    total: Int!
    tcgDexCode: String
    logo: String
    cards: [Card]
  }

  """Legacy paged search input/output (kept)"""
  input SearchInput {
    name: String
    set: String
    number: String
    forTrade: Boolean
    listed: Boolean
    rarity: String
    page: Int
    pageSize: Int
  }

  type CardSearchResult {
    cards: [Card!]!
    total: Int!
    page: Int!
    pageSize: Int!
  }

  type SetSearchResult {
    sets: [CardSet!]!
    total: Int!
  }

  """NEW: Relay-style connection types for infinite scroll"""
  type CardEdge {
    cursor: String!
    node: Card!
  }

  type PageInfo {
    hasNextPage: Boolean!
    endCursor: String
  }

  type CardConnection {
    edges: [CardEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  """NEW: Input for connection-based search (coexists with legacy SearchInput)"""
  input SearchCardsInput {
    name: String
    set: String
    number: String
    listed: Boolean
    forTrade: Boolean
    rarity: String
    first: Int = 25
    after: String
    budget: Int = 8       # how many visible nodes to give quick prices
    trustUpstream: Boolean = false
  }

  type Query {
    # Legacy endpoints (kept)
    searchCards(input: SearchInput!): CardSearchResult!
    searchSets(query: String): SetSearchResult!
    cardById(id: String!): Card
    getSet(code: String!): CardSet
    cardSetCompletion(userId: ID!, set: String!): Float!
    getExchangeRates: JSON
    allRarities: [String!]!
    cardPriceHistory(cardId: ID!, days: Int = 30): [CardPriceHistoryPoint!]!

    # NEW: connection-based search for infinite scroll / load more
    searchCardsConnection(input: SearchCardsInput!): CardConnection!
  }

  type Variants {
    firstEdition: Boolean
    holo: Boolean
    normal: Boolean 
    reverse: Boolean
    wPromo: Boolean
  }
`;
