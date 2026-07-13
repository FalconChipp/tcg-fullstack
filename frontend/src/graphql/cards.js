import { gql } from '@apollo/client';

export const PRICE_INSIGHTS_QUERY = gql`
  query CardPriceInsights($cardId: ID!, $variant: String, $historyLimit: Int!) {
    history: cardsearchPriceObservations(cardId: $cardId, variant: $variant, limit: $historyLimit) {
      date market mid low high
    }
    rollups: cardsearchPriceRollups(cardId: $cardId, variant: $variant) {
      currency
      latest { date market }
      d7 { avg change changePct }
      d30 { avg change changePct }
      d90 { avg change changePct }
    }
  }
`;

export const CARD_MARKET_PRICE_QUERY = gql`
  query CardMarketPrice($id: ID!) {
    cardsearchCard(id: $id) {
      latestPrices { variation currency gbp market }
    }
  }
`;

export const CARD_DETAIL_QUERY = gql`
  query CardDetail($id: ID!) {
    cardsearchCard(id: $id) {
      variants { key label default }
      latestPrices { variation currency gbp market }
    }
  }
`;
