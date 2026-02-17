// src/modules/push/typeDefs.js

import { gql } from "graphql-tag";

export default gql`
  type PushPrefsStatus {
    ok: Boolean!
    error: String
  }

  type Mutation {
    registerExpoPushToken(
      expoPushToken: String!
      platform: String
      deviceName: String
      appVersion: String
    ): PushPrefsStatus!

    unregisterExpoPushToken(expoPushToken: String!): PushPrefsStatus!

    sendTestPush(title: String!, body: String!): PushPrefsStatus!
  }
`;
