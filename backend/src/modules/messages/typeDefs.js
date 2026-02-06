// backend/src/modules/messages/typeDefs.js
//
// UPDATED (2026-02-06):
// - ADD: ConversationSummary + ConversationsPage types
// - ADD: MessagesPage type (for conversationMessages pagination)
// - ADD: Query.myConversations(page, pageSize): ConversationsPage!
// - ADD: Query.conversationMessages(conversationId, page, pageSize): MessagesPage!
// - ADD: Query.chatRules: String! (to match resolvers Query.chatRules)
// - ADD: Mutation.setTyping(conversationId, isTyping): Boolean! (to match resolvers Mutation.setTyping)
// - ADD: MutationResult { ok: Boolean! } for minimal ok-returning mutations
// - ADD: Schema aliases for resolver names: muteUser/unmuteUser/blockUser/unblockUser
// - KEEP: Existing schema as-is (myChats/chatWithUser/chatRulesText/etc)
//
// UPDATED (2026-02-06) (Reporting UI support):
// - CHANGE: reportUser now accepts optional details: reportUser(userId, reason, details)
// - CHANGE: reportMessage now accepts optional details: reportMessage(messageId, reason, details)
// - KEEP: Return types unchanged (Boolean!)

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
    createdAt: String
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

  # ============================
  # Added: myConversations support types
  # ============================

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

  # ============================
  # Added: minimal mutation result
  # ============================
  type MutationResult {
    ok: Boolean!
  }

  extend type Query {
    # Existing API (KEEP)
    myChats(page: Int, pageSize: Int): [ChatSummary!]!
    chatWithUser(userId: ID!, page: Int, pageSize: Int): [Message!]!
    unreadCount: Int!
    hasAgreedToChatRules: Boolean!

    # Existing (KEEP)
    chatRulesText: String!

    # ✅ ADDED: to match resolvers Query.chatRules
    chatRules: String!

    myMutedConversations: [ChatMute!]!
    myBlockedUsers: [ChatBlock!]!
    adminQueryChatBlocks(page: Int, pageSize: Int, filter: JSON): [ChatBlock!]!
    adminQueryMessages(filter: JSON, page: Int, pageSize: Int): [Message!]!
    adminQueryReportedMessages(page: Int, pageSize: Int, filter: JSON): [Message!]!
    adminQueryReportedUsers(page: Int, pageSize: Int, filter: JSON): [ReportedUser!]!

    # ✅ ADDED: Fields required by your new resolver(s)
    myConversations(page: Int, pageSize: Int): ConversationsPage!
    conversationMessages(conversationId: String!, page: Int, pageSize: Int): MessagesPage!
  }

  extend type Mutation {
    # Existing API (KEEP)
    sendMessage(receiverId: ID!, content: String!, meta: JSON): Message!
    markChatRead(userId: ID!): Boolean!
    deleteChat(userId: ID!): Boolean!

    # ✅ UPDATED: add optional details for reporting UI
    reportMessage(messageId: ID!, reason: String!, details: String): Boolean!
    reportUser(userId: ID!, reason: String!, details: String): Boolean!

    agreeToChatRules: Boolean!
    adminDeleteMessage(id: ID!): Boolean!
    adminBanUserFromChat(userId: ID!, reason: String): Boolean!
    adminUnbanUserFromChat(userId: ID!): Boolean!
    adminClearUserReport(userId: ID!): Boolean!
    adminSendSystemMessage(content: String!, meta: JSON): Boolean!

    muteConversation(userId: ID!, mutedUntil: String): Boolean!
    unmuteConversation(userId: ID!): Boolean!
    blockUserFromChat(userId: ID!, reason: String): Boolean!
    unblockUserFromChat(userId: ID!): Boolean!

    # ✅ ADDED: to match resolvers Mutation.setTyping
    setTyping(conversationId: String!, isTyping: Boolean!): Boolean!

    # ✅ ADDED: schema aliases matching your resolver names
    muteUser(userId: ID!): MutationResult!
    unmuteUser(userId: ID!): MutationResult!
    blockUser(userId: ID!): MutationResult!
    unblockUser(userId: ID!): MutationResult!
  }
`;
