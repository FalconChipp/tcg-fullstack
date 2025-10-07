// src/modules/cardsearch/typeDefs.js
// GraphQL schema (SDL) for the Card Search module.
// Types are namespaced with the `Cardsearch` prefix so the legacy search schema can
// coexist without conflicting type names or field signatures.

const typeDefs = /* GraphQL */ `
  "Generic scalar placeholders if your server doesn't already provide them"
  scalar DateTime
  scalar JSON

  "Represents a Pokémon TCG Set known to this backend"
  type CardsearchSet {
    code: String!                # canonical internal set code (e.g., 'sv08')
    abbr: String                 # marketing/display abbreviation (e.g., 'PA')
    name: String!
    series: String
    releasedAt: DateTime
    total: Int                   # total number of cards
    lang: String                 # 'en', etc.
  }

  "Container for card imagery"
  type CardsearchCardImages {
    small: String
    large: String
  }

  "A card as stored in your m_Card table (one per set_code/number)"
  type CardsearchCard {
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
    images: CardsearchCardImages
    set: CardsearchSet!

    "Available variants for this card (e.g., normal, holo, reverse, alt art, etc.)"
    variants: [CardsearchCardVariant!]!

    "Convenience: latest GBP price per variant (if requested); loaded lazily"
    latestPrices: [CardsearchPriceLatest!]
    priceRollups(variant: String, windows: [Int!]): CardsearchPriceRollups
    priceRollupsAll(variants: [String!], windows: [Int!]): [CardsearchPriceRollups!]!
  }

  "Physical/market variant for a Card (e.g., 'normal', 'reverse', 'holo', 'alt_art')"
  type CardsearchCardVariant {
    cardId: String!              # 'sv08-123'
    variant: String!             # normalized key
    displayName: String!         # 'Reverse Holo', 'Full Art', etc.
  }

  "Point-in-time latest price (denormalized for speed)"
  type CardsearchPriceLatest {
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
  type CardsearchPriceObservation {
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
  type CardsearchPriceRollups {
    cardId: String!
    variant: String!
    currency: String!            # 'GBP'

    "Latest snapshot (today or most recent trading day)"
    latest: CardsearchPricePoint

    "Window aggregates over trailing N days; fields may be null if insufficient data"
    d1: CardsearchRollupWindow
    d7: CardsearchRollupWindow
    d30: CardsearchRollupWindow
    d90: CardsearchRollupWindow
  }

  "A single timepoint; used inside CardsearchPriceRollups.latest"
  type CardsearchPricePoint {
    date: String!                # YYYY-MM-DD
    low: Float
    mid: Float
    high: Float
    market: Float
  }

  "Aggregated stats for a window (min/max/avg and change vs start)"
  type CardsearchRollupWindow {
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
    name: String
    set: String                  # accepts canonical ('sv08'), alias/abbr ('PA'), or human ('Paradox Rift')
    number: String               # string to keep suffixes like '123a'

    variant: String

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

  type CardsearchCardSearchResult {
    total: Int!
    limit: Int!
    offset: Int!
    items: [CardsearchCard!]!
  }

  # -------- Queries -----------------------------------------------------------

  type Query {
    "Unified search for cards (supports Name, Name+Set, Name+Number, Number+Set, Number, Set)"
    cardsearchSearchCards(input: CardSearchInput!): CardsearchCardSearchResult!

    "Fetch a single card by its canonical ID (e.g., 'sv08-123')"
    cardsearchCardById(cardId: ID!, variant: String): CardsearchCard

    "Latest prices for a card (optionally filtered by variant)"
    cardsearchPriceLatest(cardId: ID!, variant: String): [CardsearchPriceLatest!]!

    "Precomputed rollups for 1/7/30/90 windows"
    cardsearchPriceRollups(cardId: ID!, variant: String, windows: [Int!]): CardsearchPriceRollups
    cardsearchPriceRollupsAll(cardId: ID!, variants: [String!], windows: [Int!]): [CardsearchPriceRollups!]!

    "Optional: raw timeseries (paged) for charts or debugging"
    cardsearchPriceObservations(
      cardId: ID!
      variant: String
      startDate: String
      endDate: String
      limit: Int = 365
      offset: Int = 0
    ): [CardsearchPriceObservation!]!

    "Set lookup by code or human name"
    cardsearchSetByCode(code: String!): CardsearchSet
    cardsearchSets(query: String, limit: Int = 100, offset: Int = 0): [CardsearchSet!]!
  }

  # -------- Admin surface (minimal — wired later) ------------------------------

  input CardsearchAdminJobRunInput {
    kind: String!                 # 'ingestSet' | 'collectPrices' | 'patchGaps' | 'priceRollup' | 'fxDaily'
    set: String                   # for per-set jobs
    era: String                   # optional era filter
    budget: Int                   # optional ceiling for gap filler
  }

  type CardsearchAdminJobResult {
    ok: Boolean!
    message: String
    stats: JSON
    startedAt: DateTime!
    finishedAt: DateTime
  }

  type CardsearchAdminSetStatus {
    set: CardsearchSet!
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
    cardsearchAdminRunJob(input: CardsearchAdminJobRunInput!): CardsearchAdminJobResult!

    "Enable/disable a set for scheduled collection"
    cardsearchAdminToggleSet(code: String!, enabled: Boolean!): CardsearchAdminSetStatus!

    "Recompute rollups for a set or the entire catalog"
    cardsearchAdminRebuildRollups(set: String): CardsearchAdminJobResult!
  }
`;

export default typeDefs;
