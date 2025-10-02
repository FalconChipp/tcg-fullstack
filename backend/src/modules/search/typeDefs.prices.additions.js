// src/modules/search/typeDefs.prices.additions.js
import { gql } from 'graphql-tag';

export default gql`
  type CardPriceSeriesPoint {
    at: String!   # ISO date (YYYY-MM-DD)
    gbp: Float
  }

  extend type Query {
    cardPriceSeries(cardId: ID!, variation: String, days: Int = 30): [CardPriceSeriesPoint!]!
  }
`;
