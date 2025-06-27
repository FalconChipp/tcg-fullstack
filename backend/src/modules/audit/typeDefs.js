import { gql } from 'graphql-tag';

export default gql`
  type AuditLog {
    id: ID!
    userId: ID
    action: String!
    targetId: String
    targetType: String
    details: JSON
    ip: String
    userAgent: String
    createdAt: String
    updatedAt: String
    user: User
  }

  extend type Query {
    auditLogs(
      userId: ID
      action: String
      targetId: String
      targetType: String
      page: Int = 1
      pageSize: Int = 50
    ): [AuditLog!]!
  }
`;
