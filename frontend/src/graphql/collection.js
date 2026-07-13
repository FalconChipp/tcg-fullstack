import { gql } from '@apollo/client';

export const MY_COLLECTION_QUERY = gql`
  query MyCollection {
    myCollection {
      id
      cardId
      quantity
      condition
      variation
      card {
        id
        name
        number
        rarity
        set { name releaseDate }
        images { small large }
      }
    }
  }
`;

export const CARDSEARCH_QUERY = gql`
  query CardsearchCollectionSearch($input: CardSearchInput!) {
    searchCards: cardsearchSearchCards(input: $input) {
      total
      limit
      offset
      items {
        cardId
        id
        setCode
        number
        name
        rarity
        images { large }
        set { code name }
        variants { key default label }
        latestPrices {
          variation currency gbp market mid low high updatedAt provider
        }
      }
    }
  }
`;

export const CARDSEARCH_SETS_QUERY = gql`
  query CardsearchSetAutocomplete($limit: Int!, $offset: Int!) {
    cardsearchSets(limit: $limit, offset: $offset) {
      code
      abbr
      name
      series
      releasedAt
      lang
    }
  }
`;

export const CARDSEARCH_BULK_ADD_TO_COLLECTION = gql`
  mutation CardsearchBulkAddToCollection($input: CardsearchBulkAddInput!) {
    cardsearchBulkAddToCollection(input: $input) {
      ok
      message
      items {
        cardId quantity created previousQuantity newQuantity error
      }
    }
  }
`;
