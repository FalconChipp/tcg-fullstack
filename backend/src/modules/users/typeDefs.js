import { gql } from 'graphql-tag';

export default gql`
scalar Upload
  type User {
    id: ID!
    username: String!
    email: String!
    emailVerified: Boolean
    avatar: String
    isAdmin: Boolean!
    isBanned: Boolean!
    lastLogin: String
    createdAt: String
    updatedAt: String
    profile: Profile
    referrerId: ID
    referrer: User
    mfaEnabled: Boolean
    googleId: String
    oauthProvider: String
    oauthId: String
  }

  type Profile {
    id: ID!
    userId: ID!
    bio: String
    favouritePokemon: String
    avatar: String
    country: String
    showcase: JSON
    status: String
    address1: String
    address2: String
    city: String
    postcode: String
    state: String
    phone: String
    discord: String
    publicProfile: Boolean
    wantsTrade: Boolean
    wantsMarketplace: Boolean
    createdAt: String
    updatedAt: String
    user: User
  }

  scalar JSON

  enum ProfileStatus {
    "Looking to Trade"
    LOOKING_TO_TRADE
    "Just Collecting"
    JUST_COLLECTING
    "Open to Chat"
    OPEN_TO_CHAT
    "Building a Master Set"
    BUILDING_A_MASTER_SET
    "Marketplace Seller"
    MARKETPLACE_SELLER
    "Inactive"
    INACTIVE
  }

  type Query {
    userProfile(username: String!): Profile
    userById(id: ID!): User
    searchUsers(query: String!, limit: Int): [Profile!]
    allUsers(limit: Int): [User!]!
    profileStatuses: [String!]!
  }

  type Mutation {
    updateProfile(
      bio: String
      favouritePokemon: String
      avatar: String
      country: String
      showcase: JSON
      status: String
      address1: String
      address2: String
      city: String
      postcode: String
      state: String
      phone: String
      discord: String
      publicProfile: Boolean
      wantsTrade: Boolean
      wantsMarketplace: Boolean
    ): Profile

    adminBanUser(userId: ID!): Boolean
    adminUnbanUser(userId: ID!): Boolean
    adminDeleteUser(userId: ID!): Boolean
  }
`;
