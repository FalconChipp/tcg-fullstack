import { gql } from 'graphql-tag';

export default gql`
  type Message {
    id: ID!
    senderId: ID!
    receiverId: ID!
    content: String!
    isRead: Boolean!
    deletedBySender: Boolean!
    deletedByReceiver: Boolean!
    meta: JSON
    isFlagged: Boolean!
    flagReason: String
    flaggedById: ID
    isSystemMessage: Boolean!
    reminderSentAt: String
    createdAt: String
    updatedAt: String
    expiresAt: String
    sender: User
    receiver: User
    flaggedBy: User
  }

  type ChatSummary {
    user: User!
    lastMessage: Message
    unreadCount: Int!
  }

  type ReportedUser {
    id: ID!
    user: User!
    reporter: User!
    reason: String!
    createdAt: String
  }

  type ChatAgreement {
    userId: ID!
    agreedAt: String!
  }

  extend type Query {
    myChats(page: Int, pageSize: Int): [ChatSummary!]!
    chatWithUser(userId: ID!, page: Int, pageSize: Int): [Message!]!
    unreadCount: Int!
    hasAgreedToChatRules: Boolean!
    adminQueryMessages(filter: JSON, page: Int, pageSize: Int): [Message!]!
    adminQueryReportedMessages(page: Int, pageSize: Int, filter: JSON): [Message!]!
    adminQueryReportedUsers(page: Int, pageSize: Int, filter: JSON): [ReportedUser!]!
  }

  extend type Mutation {
    sendMessage(receiverId: ID!, content: String!, meta: JSON): Message!
    markChatRead(userId: ID!): Boolean!
    deleteChat(userId: ID!): Boolean!
    reportMessage(messageId: ID!, reason: String!): Boolean!
    reportUser(userId: ID!, reason: String!): Boolean!
    agreeToChatRules: Boolean!
    adminDeleteMessage(id: ID!): Boolean!
    adminBanUserFromChat(userId: ID!, reason: String): Boolean!
    adminUnbanUserFromChat(userId: ID!): Boolean!
    adminClearUserReport(userId: ID!): Boolean!
    adminSendSystemMessage(content: String!, meta: JSON): Boolean!
  }
`;
