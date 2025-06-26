import { gql } from 'graphql-tag';

export default gql`
  type Notification {
    id: ID!
    userId: ID
    type: String!
    title: String!
    body: String!
    iconUrl: String
    linkUrl: String
    isRead: Boolean!
    isDismissed: Boolean!
    meta: JSON
    expiresAt: String
    isSilent: Boolean!
    isBroadcast: Boolean!
    emailSentAt: String
    createdAt: String
    updatedAt: String
  }

  type NotificationPage {
    notifications: [Notification!]!
    total: Int!
    page: Int!
    pageSize: Int!
  }

  input NotificationInput {
    userId: ID
    type: String!
    title: String!
    body: String!
    iconUrl: String
    linkUrl: String
    meta: JSON
    expiresAt: String
    isSilent: Boolean
    isBroadcast: Boolean
  }

  extend type Query {
    myNotifications(page: Int, pageSize: Int, filter: JSON): NotificationPage!
    notification(id: ID!): Notification
    unreadNotificationCount: Int!
  }

  extend type Mutation {
    markNotificationRead(id: ID!): Boolean!
    markAllNotificationsRead: Boolean!
    dismissNotification(id: ID!): Boolean!
    adminSendBroadcastNotification(input: NotificationInput!): Boolean!
    adminDeleteNotification(id: ID!): Boolean!
  }
`;
