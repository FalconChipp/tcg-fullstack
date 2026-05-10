// src/graphql/adminOverview.js
import { gql } from '@apollo/client';

export const ADMIN_OVERVIEW_QUERY = gql`
  query AdminOverview($usersLimit: Int, $listingsLimit: Int) {
    allUsers(limit: $usersLimit) {
      id
      isAdmin
      isBanned
    }
    listings(limit: $listingsLimit) {
      __typename
      id
      type
      status
    }
  }
`;

export { AdminQueryReportedUsersDocument as ADMIN_REPORTED_USERS_QUERY } from '@sixbyfive/api-client';
