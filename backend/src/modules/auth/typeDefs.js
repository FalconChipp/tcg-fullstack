// src/modules/auth/typeDefs.js

import { gql } from 'graphql-tag';

const typeDefs = gql`
  type AuthPayload {
    token: String!
    user: User!
  }

  type MFASetupPayload {
    otpauthUrl: String!
    qrCodeDataURL: String!
  }

  type Mutation {
    register(
      username: String!
      email: String!
      password: String!
      referrerId: ID
    ): AuthPayload!

    login(
      email: String!
      password: String!
      mfaToken: String
    ): AuthPayload!

    loginGoogle(googleToken: String!): AuthPayload!

    enableMFA: MFASetupPayload!
    verifyMFA(code: String!): Boolean!
    disableMFA: Boolean!

    requestPasswordReset(email: String!): Boolean!
    resetPassword(token: String!, newPassword: String!): Boolean!

    verifyEmail(token: String!): Boolean!
    resendVerification(email: String!): Boolean!
  }

  type Query {
    me: User
  }
`;

export default typeDefs;
