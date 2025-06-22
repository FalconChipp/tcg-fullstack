// src/modules/achievements/typeDefs.js
const gql = require('graphql-tag');

module.exports = gql`
  type Achievement {
    id: ID!
    code: String!
    name: String!
    description: String
    tier: String
    imageUrl: String
    createdAt: String
    updatedAt: String
  }

  type UserAchievement {
    id: ID!
    achievement: Achievement!
    earnedAt: String!
  }

  type Query {
    achievements: [Achievement!]!
    userAchievements(userId: ID): [UserAchievement!]!
  }

  type Mutation {
    unlockAchievement(code: String!): UserAchievement!
  }
`;
