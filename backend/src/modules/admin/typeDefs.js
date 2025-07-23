// src/modules/admin/typeDefs.js

import { gql } from 'graphql-tag';

const adminTypeDefs = gql`
  type AdminStats {
    totalUsers: Int!
    totalActiveUsers: Int!
    totalListings: Int!
    totalCards: Int!
    totalTrades: Int!
    totalBanned: Int!
  }

  extend type Query {
    adminStats: AdminStats!
  }
`;

export default adminTypeDefs;
