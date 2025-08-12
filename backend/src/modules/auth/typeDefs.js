import { gql } from 'graphql-tag';

const typeDefs = gql`
  type AuthPayload {
    token: String!
    user: User!
  }

  # Renamed to 2FASetupPayload for clarity
  type TwoFactorSetupPayload {
    otpauthUrl: String!
    qrCodeDataURL: String!
  }

  extend type User {
    twoFactorEnabled: Boolean!
  }

  type Mutation {
    register(
      username: String!
      email: String!
      password: String!
      referrerId: ID
    ): AuthPayload!

    login(
      email: String
      username: String
      password: String!
      twoFactorToken: String
    ): AuthPayload!

    loginGoogle(googleToken: String!): AuthPayload!

    # Unified naming: enable/verify/disable 2FA (no more "MFA" in API)
    enableTwoFactor: TwoFactorSetupPayload!
    verifyTwoFactor(code: String!): Boolean!
    disableTwoFactor: Boolean!

    requestPasswordReset(email: String!): Boolean!
    resetPassword(token: String!, newPassword: String!): Boolean!

    verifyEmail(token: String!): Boolean!
    resendVerification(email: String!): Boolean!

    # -------------------------------
    # Added mutations for updating password/email
    changePassword(currentPassword: String!, newPassword: String!): Boolean!
    changeEmail(newEmail: String!, currentPassword: String!): Boolean!
    # -------------------------------
  }

  type Query {
    me: User
  }
`;

export default typeDefs;
