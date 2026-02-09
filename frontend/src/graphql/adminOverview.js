// frontend/src/graphql/adminOverview.js

import { gql } from "@apollo/client";

export const ADMIN_OVERVIEW_QUERY = gql`
  query AdminOverview($usersLimit: Int!) {
    allUsers(limit: $usersLimit) {
      id
      username
      email
      isAdmin
      isBanned
      createdAt
      lastLogin
      profile {
        country
        status
        favouritePokemon
      }
    }
  }
`;

export const ADMIN_REPORTED_USERS_QUERY = gql`
  query AdminReportedUsers($page: Int, $pageSize: Int, $filter: JSON) {
    adminQueryReportedUsers(page: $page, pageSize: $pageSize, filter: $filter) {
      id
      reason
      details
      isCleared
      createdAt
      updatedAt
      user {
        id
        username
        email
      }
      reporter {
        id
        username
        email
      }
    }
  }
`;