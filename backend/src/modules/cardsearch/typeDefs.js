// src/modules/cardsearch/typeDefs.js
// GraphQL schema (SDL) for the Card Search module.
// - Supports six search modes: Name, Name+Set, Name+Number, Number+Set, Number, Set
// - Returns latest pricing and 1/7/30/90-day rollups
// - Pure DB reads at query time; ingestion/pricing/FX handled by jobs
//
// Export: a single string containing SDL. Your module loader should import this
// and pass to ApolloServer (or equivalent) alongside resolvers.
//
// Implementation notes:
// - "cardId" refers to your canonical ID format: `${set_code}-${number}` (e.g., "sv08-123").
// - "variant" is optional and normalized in resolvers (e.g., "normal", "holo", "rev", "alt_art").
// - Pricing values are expressed in GBP; vendor currency conversion happens at ingestion time.
// - Admin mutations are minimal stubs here; we’ll wire their resolvers later.

const typeDefs = /* GraphQL */ `
  "Generic scalar placeholders if your server doesn't already provide them"
  scalar DateTime
  scalar JSON

  "Represents a Pokémon TCG Set known to this backend"
  type Set {
    code: String!                # canonical internal set code (e.g., 'sv08')
    abbr: String                 # marketing/display abbreviation (e.g., 'PA')
    name: String!
    series: String
    releasedAt: DateTime
    total: Int                   # total number of cards
    lang: String                 # 'en', etc.
  }

  "A card as stored in your m_Card table (one per set_code/number)"
  type Card {
    id: ID!                      # same as cardId (set_code-number)
    cardId: String!              # 'sv08-123'
    setCode: String!             # 'sv08'
    number: String!              # string to preserve leading zeros/suffixes
    name: String!
    rarity: String
    supertype: String
    subtypes: [String!]
    types: [String!]
    regulationMark: String
    illustrator: String
    images: CardImages
    set: Set!

    "Available variants for this card (e.g., normal, holo, reverse, alt art, etc.)"
    variants: [CardVariant!]!

    "Convenience: latest GBP price per variant (if requested); loaded lazily"
    latestPrices: [PriceLatest!]
  }

  type CardImages {
    small: String
    large: String
  }

  "Physical/market variant for a Card (e.g., 'normal', 'reverse', 'holo', 'alt_art')"
  type CardVariant {
    cardId: String!              # 'sv08-123'
    variant: String!             # normalized key
    displayName: String!         # 'Reverse Holo', 'Full Art', etc.
  }

  "Point-in-time latest price (denormalized for speed)"
  type PriceLatest {
    cardId: String!
    variant: String!
    currency: String!            # 'GBP' (post-conversion)
    low: Float
    mid: Float
    high: Float
    market: Float
    updatedAt: DateTime!
    provider: String             # 'tcgdex' | 'ptcgio' | 'ppt' | 'composite'
  }

  "Daily price observation for charting; typically resolved via rollups or direct"
  type PriceObservation {
    cardId: String!
    variant: String!
    date: String!                # YYYY-MM-DD
    currency: String!            # 'GBP'
    low: Float
    mid: Float
    high: Float
    market: Float
    provider: String
  }

  "Precomputed windows for fast UI spark-lines and summaries"
  type PriceRollups {
    cardId: String!
    variant: String!
    currency: String!            # 'GBP'

    "Latest snapshot (today or most recent trading day)"
    latest: PricePoint

    "Window aggregates over trailing N days; fields may be null if insufficient data"
    d1: RollupWindow
    d7: RollupWindow
    d30: RollupWindow
    d90: RollupWindow
  }

  "A single timepoint; used inside PriceRollups.latest"
  type PricePoint {
    date: String!                # YYYY-MM-DD
    low: Float
    mid: Float
    high: Float
    market: Float
  }

  "Aggregated stats for a window (min/max/avg and change vs start)"
  type RollupWindow {
    startDate: String!           # inclusive
    endDate: String!             # inclusive
    count: Int!                  # number of observations in window

    min: Float
    max: Float
    avg: Float

    "Change over window: absolute & percentage vs first available observation"
    change: Float
    changePct: Float
  }

  "Search parameters covering Name/Set/Number combos"
  input CardSearchInput {
    # Any combination of these enables the six search modes you listed:
    name: String
    set: String                  # accepts canonical ('sv08'), alias/abbr ('PA'), or human ('Paradox Rift')
    number: String               # string to keep suffixes like '123a'

    # Optional variant filter—otherwise return all variants for each card
    variant: String

    # Search behavior
    fuzzy: Boolean = true        # fuzzy name matching on tokenized fields
    limit: Int = 50
    offset: Int = 0
    orderBy: CardSearchOrder = RELEVANCE
  }

  enum CardSearchOrder {
    RELEVANCE
    NAME_ASC
    NAME_DESC
    NUMBER_ASC
    NUMBER_DESC
    SET_ASC
    SET_DESC
  }

  type CardSearchResult {
    total: Int!
    limit: Int!
    offset: Int!
    items: [Card!]!
  }

  # -------- Queries -----------------------------------------------------------

  type Query {
    "Unified search for cards (supports Name, Name+Set, Name+Number, Number+Set, Number, Set)"
    searchCards(input: CardSearchInput!): CardSearchResult!

    "Fetch a single card by its canonical ID (e.g., 'sv08-123')"
    cardById(cardId: ID!, variant: String): Card

    "Latest prices for a card (optionally filtered by variant)"
    priceLatest(cardId: ID!, variant: String): [PriceLatest!]!

    "Precomputed rollups for 1/7/30/90 windows"
    priceRollups(cardId: ID!, variant: String): PriceRollups

    "Optional: raw timeseries (paged) for charts or debugging"
    priceObservations(
      cardId: ID!
      variant: String
      startDate: String
      endDate: String
      limit: Int = 365
      offset: Int = 0
    ): [PriceObservation!]!

    "Set lookup by code or human name"
    setByCode(code: String!): Set
    sets(query: String, limit: Int = 100, offset: Int = 0): [Set!]!
  }

  # -------- Admin surface (minimal—wired later) ------------------------------

  input AdminJobRunInput {
    kind: String!                 # 'ingestSet' | 'collectPrices' | 'patchGaps' | 'priceRollup' | 'fxDaily'
    set: String                   # for per-set jobs
    era: String                   # optional era filter
    budget: Int                   # optional ceiling for gap filler
  }

  type AdminJobResult {
    ok: Boolean!
    message: String
    stats: JSON
    startedAt: DateTime!
    finishedAt: DateTime
  }

  type AdminSetStatus {
    set: Set!
    hasCache: Boolean!
    lastIngestAt: DateTime
    lastPriceCollectAt: DateTime
    lastRollupAt: DateTime
    cardCount: Int
    variantCount: Int
    latestCoveragePct: Float
    observationsCount: Int
    staleDays: Int                # days since last price update
    enabled: Boolean             # whether scheduler will pick this set
  }

  type Mutation {
    "Run a specific maintenance job immediately"
    adminRunJob(input: AdminJobRunInput!): AdminJobResult!

    "Enable/disable a set for scheduled collection"
    adminToggleSet(code: String!, enabled: Boolean!): AdminSetStatus!

    "Recompute rollups for a set or the entire catalog"
    adminRebuildRollups(set: String): AdminJobResult!
  }
`;

export default typeDefs;
