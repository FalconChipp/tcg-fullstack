// src/graphql/adminOverview.js
import { gql } from '@apollo/client';

export const ADMIN_OVERVIEW_QUERY = gql`
  query AdminOverview($usersLimit: Int, $listingsLimit: Int) {
    allUsers(limit: $usersLimit) {
      id
      username
      email
      isAdmin
      isBanned
      emailVerified
      createdAt
      lastLogin
      profile {
        country
        status
        favouritePokemon
      }
    }
    listings(limit: $listingsLimit) {
      __typename
      id
      type
      status
    }
  }
`;

export const ADMIN_REPORTED_USERS_QUERY = gql`
  query AdminQueryReportedUsers($page: Int, $pageSize: Int, $isCleared: Boolean) {
    adminQueryReportedUsers(page: $page, pageSize: $pageSize, isCleared: $isCleared) {
      id
      userId
      reporterId
      reason
      details
      isCleared
      createdAt
      user {
        id
        username
        avatar
      }
      reporter {
        id
        username
      }
    }
  }
`;
