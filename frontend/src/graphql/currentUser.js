// frontend/src/graphql/queries/currentUser.js

import { gql } from "@apollo/client";

export const CURRENT_USER_QUERY = gql`
  query CurrentUser {
    me {
      id
      username
      email
      avatar
      isAdmin
      isBanned
      createdAt
      updatedAt
      lastLogin
    }
  }
`;
