const gql = require('graphql-tag');

module.exports = gql`
  type Admin {
    id: ID!
    email: String!
    createdAt: String
    updatedAt: String
  }

  type AdminAuthPayload {
    token: String!
    admin: Admin!
  }

  type Query {
    adminUsers(limit: Int = 50, offset: Int = 0): [User!]!
    adminBinders(limit: Int = 50, offset: Int = 0): [Binder!]!
    adminCards(limit: Int = 50, offset: Int = 0): [Card!]!
    adminMarketplaceListings(limit: Int = 50, offset: Int = 0): [MarketplaceListing!]!
  }

  type Mutation {
    adminLogin(email: String!, password: String!): AdminAuthPayload!
    adminDeleteBinder(id: ID!): Boolean!
    adminDeleteCard(id: String!): Boolean!
    adminDeleteMarketplaceListing(id: ID!): Boolean!
  }
`;
