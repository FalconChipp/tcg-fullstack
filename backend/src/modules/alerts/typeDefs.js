// src/modules/alerts/typeDefs.js
import { gql } from 'graphql-tag';

export default gql`
  enum PriceCondition {
    pct_up
    pct_down
    above
    below
  }

  type PriceAlert {
    id: ID!
    cardId: ID!
    variation: String
    condition: PriceCondition!
    value: Float!
    windowHours: Int!
    isActive: Boolean!
    cooldownHours: Int!
    lastFiredAt: String
    currency: String!
    createdAt: String!
    updatedAt: String!
  }

  input UpsertPriceAlertInput {
    id: ID
    cardId: ID!
    variation: String
    condition: PriceCondition!
    value: Float
    windowHours: Int = 24
    isActive: Boolean = true
    cooldownHours: Int = 12
    currency: String = "GBP"
  }

  extend type Query {
    myPriceAlerts: [PriceAlert!]!
  }

  extend type Mutation {
    upsertPriceAlert(input: UpsertPriceAlertInput!): PriceAlert!
    deletePriceAlert(id: ID!): Boolean!
    togglePriceAlert(id: ID!, active: Boolean!): Boolean!
  }
`;
