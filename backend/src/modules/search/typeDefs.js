import { gql } from 'graphql-tag';

export default gql`
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

  type Query {
    searchCards(input: SearchInput!): CardSearchResult!
    searchSets(query: String): SetSearchResult!
    cardById(id: String!): Card
    getSet(code: String!): CardSet
    cardSetCompletion(userId: ID!, set: String!): Float!
    getExchangeRates: JSON
    allRarities: [String!]!
    cardPriceHistory(cardId: ID!, days: Int = 30): [CardPriceHistoryPoint!]!
  }

  type Variants {
    firstEdition: Boolean
    holo: Boolean
    normal: Boolean 
    reverse: Boolean
    wPromo: Boolean
  }
`;
