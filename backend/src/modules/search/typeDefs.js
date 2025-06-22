// src/modules/search/typeDefs.js
const gql = require('graphql-tag');

module.exports = gql`
  type Card {
    id: String!
    name: String!
    set: String
    number: String
    rarity: String
    imageUrl: String
    price: Float
  }

  type Query {
    searchCards(
      name: String
      set: String
      number: String
      rarity: String
      limit: Int = 30
      offset: Int = 0
    ): [Card!]!
    getCard(id: String!): Card
  }
`;
