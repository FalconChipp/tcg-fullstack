// backend/src/modules/safety/typeDefs.js

import { gql } from "graphql-tag";

export default gql`
  type Capabilities {
    restrictionLevel: String!
    isMinor: Boolean!
    requiresParentApproval: Boolean!

    canUseCollection: Boolean!

    canMessage: Boolean!
    canTrade: Boolean!
    canPost: Boolean!

    canConnectDiscord: Boolean!
    canShareToDiscord: Boolean!
  }

  type SafetyProfileResult {
    ok: Boolean!
    user: User
    error: String
  }

  extend type User {
    # READ-ONLY exposure (backed by DB fields)
    dob: String
    restrictionLevel: String
    parentEmail: String
    parentVerifiedAt: String

    # Computed, always available
    capabilities: Capabilities!
  }

  extend type Mutation {
    # User self-service
    updateSafetyProfile(dob: String, parentEmail: String): SafetyProfileResult!
    requestParentVerification: SafetyProfileResult!

    # Admin override
    adminSetUserRestriction(userId: ID!, restrictionLevel: String!): SafetyProfileResult!
    adminSetParentVerified(userId: ID!, verified: Boolean!): SafetyProfileResult!
    adminClearParentLink(userId: ID!): SafetyProfileResult!
  }
`;
