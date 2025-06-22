// src/modules/auth/typeDefs.js
const gql = require('graphql-tag');

module.exports = gql`
  type User {
    id: ID!
    email: String!
    username: String!
    avatarUrl: String
    isVerified: Boolean!
    isAdmin: Boolean!
    lastLoginAt: String
    createdAt: String
    updatedAt: String
    # 2FA
    mfaEnabled: Boolean!
    # OAuth fields
    oauthProvider: String
    oauthId: String
  }

  type AuthPayload {
    token: String!
    user: User!
    requires2FA: Boolean
  }

  type Session {
    id: ID!
    deviceInfo: String
    ipAddress: String
    createdAt: String
    expiresAt: String
  }

  type ActivityLog {
    id: ID!
    type: String!
    details: JSON
    ip: String
    createdAt: String
  }

  scalar JSON

  type Mutation {
    # Standard Auth
    register(email: String!, username: String!, password: String!): AuthPayload!
    login(login: String!, password: String!, twoFACode: String): AuthPayload!
    verifyEmail(token: String!): Boolean!
    requestPasswordReset(email: String!): Boolean!
    resetPassword(token: String!, newPassword: String!): Boolean!

    # Email change with re-verification
    requestEmailChange(newEmail: String!): Boolean!
    verifyEmailChange(token: String!): Boolean!

    # 2FA
    enable2FA: String!        # Returns QR code image data URL
    verify2FA(code: String!): Boolean!
    disable2FA: Boolean!

    # Session management
    logoutSession(sessionId: ID!): Boolean!
    logoutAllSessions: Boolean!

    # Account deletion / GDPR
    deleteMyAccount(password: String!): Boolean!
    requestDataExport: Boolean!

    # Admin: (require admin rights)
    adminDeleteUser(userId: ID!): Boolean!
  }

  type Query {
    me: User

    # Session info
    activeSessions: [Session!]!

    # Activity logs
    myActivityLog(limit: Int = 20): [ActivityLog!]!

    # Admin log browser
    allActivityLogs(
      userId: ID,
      type: String,
      limit: Int = 50,
      since: String
    ): [ActivityLog!]!
  }
`;
