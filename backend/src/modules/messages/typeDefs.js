// backend/src/modules/messages/typeDefs.js

import { gql } from "graphql-tag";

export default gql`
  scalar JSON

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

    details: String

    isCleared: Boolean
    createdAt: String
    updatedAt: String
  }

  type ChatAgreement {
    userId: ID!
    agreedAt: String!
  }

  type ChatMute {
    id: ID!
    userId: ID!
    otherUserId: ID!
    mutedUntil: String
    createdAt: String
    updatedAt: String
  }

  type ChatBlock {
    id: ID!
    blockerId: ID!
    blockedId: ID!
    reason: String
    createdAt: String
    updatedAt: String
    blocker: User
    blocked: User
  }

  type ConversationSummary {
    conversationId: String!
    lastMessage: Message
  }

  type ConversationsPage {
    page: Int!
    pageSize: Int!
    items: [ConversationSummary!]!
  }

  type MessagesPage {
    page: Int!
    pageSize: Int!
    items: [Message!]!
  }

  type MutationResult {
    ok: Boolean!
  }

  extend type Query {
    myChats(page: Int, pageSize: Int): [ChatSummary!]!
    chatWithUser(userId: ID!, page: Int, pageSize: Int): [Message!]!
    unreadCount: Int!
    hasAgreedToChatRules: Boolean!

    chatRulesText: String!
    chatRules: String!

    myMutedConversations: [ChatMute!]!
    myBlockedUsers: [ChatBlock!]!
    adminQueryChatBlocks(page: Int, pageSize: Int, filter: JSON): [ChatBlock!]!
    adminQueryMessages(filter: JSON, page: Int, pageSize: Int): [Message!]!
    adminQueryReportedMessages(page: Int, pageSize: Int, filter: JSON): [Message!]!
    adminQueryReportedUsers(page: Int, pageSize: Int, filter: JSON): [ReportedUser!]!

    myConversations(page: Int, pageSize: Int): ConversationsPage!
    conversationMessages(conversationId: String!, page: Int, pageSize: Int): MessagesPage!
  }

  extend type Mutation {
    sendMessage(receiverId: ID!, content: String!, meta: JSON): Message!
    markChatRead(userId: ID!): Boolean!
    deleteChat(userId: ID!): Boolean!

    reportMessage(messageId: ID!, reason: String!, details: String): Boolean!
    reportUser(userId: ID!, reason: String!, details: String): Boolean!

    agreeToChatRules: Boolean!
    adminDeleteMessage(id: ID!): Boolean!
    adminWarnUserFromChat( userId: ID!, content: String!, meta: JSON): Boolean!
    adminBanUserFromChat(userId: ID!, reason: String): Boolean!
    adminUnbanUserFromChat(userId: ID!): Boolean!
    adminClearUserReport(userId: ID!): Boolean!

    adminSendSystemMessage(receiverId: ID!, content: String!, meta: JSON): Boolean!

    muteConversation(userId: ID!, mutedUntil: String): Boolean!
    unmuteConversation(userId: ID!): Boolean!
    blockUserFromChat(userId: ID!, reason: String): Boolean!
    unblockUserFromChat(userId: ID!): Boolean!

    setTyping(conversationId: String!, isTyping: Boolean!): Boolean!

    muteUser(userId: ID!): MutationResult!
    unmuteUser(userId: ID!): MutationResult!
    blockUser(userId: ID!): MutationResult!
    unblockUser(userId: ID!): MutationResult!
  }
`;
