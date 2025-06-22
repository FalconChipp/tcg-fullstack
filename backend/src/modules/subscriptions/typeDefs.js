// src/modules/subscriptions/typeDefs.js
const gql = require('graphql-tag');

module.exports = gql`
  type SubscriptionTier {
    id: ID!
    code: String!
    name: String!
    description: String
    price: Float!
    stripePriceId: String
  }

  type Subscription {
    id: ID!
    tier: SubscriptionTier!
    active: Boolean!
    validUntil: String
    stripeSubscriptionId: String
    createdAt: String
    updatedAt: String
  }

  type Query {
    subscriptionTiers: [SubscriptionTier!]!
    mySubscription: Subscription
  }

  type Mutation {
    createSubscriptionCheckoutSession(tierCode: String!): String!
    cancelMySubscription: Boolean!
  }
`;
