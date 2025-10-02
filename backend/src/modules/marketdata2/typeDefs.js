// src/modules/marketdata2/typeDefs.js
export default /* GraphQL */ `
  scalar JSON
  scalar DateTime

  type FxRatesGBP {
    USD: Float!
    EUR: Float!
    updatedAt: DateTime!
    source: String!
  }

  type ProviderHealth {
    name: String!
    ok: Boolean!
    latencyMs: Int
    message: String
    checkedAt: DateTime!
  }

  type MarketdataSetStatus {
    setCode: String!
    abbr: String
    name: String
    era: String
    cardsCount: Int
    variants: [String!]!
    cardsLastFetchedAt: DateTime
    cardsNextScheduledAt: DateTime
    pricesLastFetchedAt: DateTime
    pricesNextScheduledAt: DateTime
    priceSources: [String!]!
  }

  # -------- NEW: Search types --------
  input CardSearchInput {
    q: String
    setCode: String
    number: String
    rarity: String
    supertype: String
    subtype: String
    typeIn: [String!]
    variantIn: [String!]
  }

  type CardLite {
    id: ID!             # "sv08-123"
    set_code: String!
    number: String
    name: String
    rarity: String
    supertype: String
    subtype: String
    types: [String!]
    image_small: String
    image_large: String
    variants: [String!]!
  }

  type CardSearchResult {
    total: Int!
    offset: Int!
    limit: Int!
    items: [CardLite!]!
  }
  # -------- /NEW --------

  type MarketdataRunResult {
    ok: Boolean!
    setCode: String
    scope: JSON
    counts: JSON
    startedAt: DateTime!
    finishedAt: DateTime!
    errors: [String!]!
  }

  type MarketdataTickResult {
    ok: Boolean!
    type: String!      # "metadata" | "pricing" | "patch"
    scope: JSON
    startedAt: DateTime!
    finishedAt: DateTime!
    message: String
    counts: JSON
    errors: [String!]
  }

  type Query {
    marketdataFx: FxRatesGBP!
    marketdataProvidersHealth: [ProviderHealth!]!
    marketdataSets(era: String): [MarketdataSetStatus!]!

    # -------- NEW: the search query --------
    searchCards(input: CardSearchInput, offset: Int = 0, limit: Int = 50): CardSearchResult!
  }

  type Mutation {
    marketdataTickMetadata(limit: Int): MarketdataTickResult!
    marketdataTickPricing(limit: Int): MarketdataTickResult!
    marketdataTickPatch(staleHours: Int = 72, maxCandidates: Int = 300): MarketdataTickResult!

    marketdataCollectSet(setCode: String!): MarketdataRunResult!
    marketdataCollectPrices(setCode: String!): MarketdataRunResult!
    marketdataCollectBoth(setCode: String!): MarketdataRunResult!

    marketdataRefreshFx: FxRatesGBP!
  }
`;
