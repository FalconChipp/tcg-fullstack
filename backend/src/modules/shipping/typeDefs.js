import { gql } from 'graphql-tag';

export default gql`
  scalar JSON

  type ShippingRate {
    id: ID!
    carrier: String!
    service: String!
    rate: Float!
    currency: String
    deliveryDays: Int
  }

  type ShippingLabel {
    id: ID!
    userId: ID!
    carrier: String
    serviceLevel: String
    rate: Float
    labelUrl: String
    trackingNumber: String
    status: String
    cost: Float
    apiFee: Float
    refundStatus: String
    refundedAt: String
    createdAt: String
    updatedAt: String
    meta: JSON
  }

  input AddressInput {
    name: String
    street1: String!
    street2: String
    city: String!
    state: String
    zip: String!
    country: String!
    phone: String
    email: String
  }

  input ParcelInput {
    length: Float
    width: Float
    height: Float
    weight: Float!
  }

  type Query {
    shippingRates(to: AddressInput!, from: AddressInput!, parcel: ParcelInput!): [ShippingRate!]!
    shippingLabel(id: ID!): ShippingLabel
  }

  type Mutation {
    createShippingLabel(
      to: AddressInput!
      from: AddressInput!
      parcel: ParcelInput!
      rateId: String!
      relatedType: String
      relatedId: ID
    ): ShippingLabel!
    cancelShippingLabel(id: ID!): Boolean!
  }
`;
