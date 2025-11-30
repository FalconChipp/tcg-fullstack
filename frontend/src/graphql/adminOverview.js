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
