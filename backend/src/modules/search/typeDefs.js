// src/modules/search/typeDefs.js
const gql = require('graphql-tag');

module.exports = gql`
  type TCGPlayerVariation {
    direct_low: Float
    high: Float
    low: Float
    market: Float
    mid: Float
  }

  type CardMarketVariation {
    average_sell: Float
    low: Float
    trend: Float
  }

  type CardPricing {
    updated_at: String
    tcgplayer: TCGPlayerVariation
    cardmarket: CardMarketVariation
  }

  type Card {
    id: String!
    name: String!
    number: String
    set: String
    setName: String
    setLogo: String
    setSymbol: String
    image: String
    rarity: String
    edition: String
    variations: [String]
    pricing: CardPricing
    tcgplayerVariations: TCGRarityVariations
    cardmarketVariations: CardMarketRarityVariations
  }

  type TCGRarityVariations {
    normal: TCGPlayerVariation
    reverseHolofoil: TCGPlayerVariation
    holofoil: TCGPlayerVariation
  }

  type CardMarketRarityVariations {
    normal: CardMarketVariation
    reverseHolofoil: CardMarketVariation
    holofoil: CardMarketVariation
  }

  type Query {
    searchCards(
      name: String
      set: String
      number: String
      rarity: String
      limit: Int = 30
      offset: Int = 0
      fullData: Boolean = true
    ): [Card!]!
    getCard(id: String!): Card
  }
`;
