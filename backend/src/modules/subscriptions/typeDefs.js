import { gql } from 'graphql-tag';

export default gql`
  type SubscriptionTier {
    id: ID!
    name: String!
    price: Float!
    interval: String!
    featureFlags: JSON
    limits: JSON
    feeDiscount: Float
    shippingDiscount: Float
    createdAt: String
    updatedAt: String
  }

  type Subscription {
    id: ID!
    userId: ID!
    tierId: ID!
    status: String!
    stripeSubId: String
    periodEnd: String
    cancelledAt: String
    createdAt: String
    updatedAt: String
    tier: SubscriptionTier
  }

  type SubscriptionAddOn {
    id: ID!
    userId: ID!
    type: String!
    quantity: Int!
    expiresAt: String
    meta: JSON
    createdAt: String
    updatedAt: String
  }

  extend type Query {
    mySubscription: Subscription
    subscriptionTiers: [SubscriptionTier!]!
  }

  extend type Mutation {
    createSubscription(tierId: ID!, paymentMethodId: String!): Subscription!
    cancelSubscription: Boolean!
  }
`;
