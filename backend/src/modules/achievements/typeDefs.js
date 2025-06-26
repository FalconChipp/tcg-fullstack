import { gql } from 'graphql-tag';

export default gql`
  type Achievement {
    id: ID!
    code: String!
    name: String!
    description: String
    tier: String
    iconUrl: String
    points: Int
    isActive: Boolean
    criteria: JSON
    isHidden: Boolean
    createdAt: String
    updatedAt: String
  }

  type UserAchievement {
    id: ID!
    userId: ID!
    achievementId: ID!
    earnedAt: String
    meta: JSON
    createdAt: String
    updatedAt: String
    achievement: Achievement
  }

  input AchievementInput {
    code: String
    name: String
    description: String
    tier: String
    iconUrl: String
    points: Int
    isActive: Boolean
    criteria: JSON
    isHidden: Boolean
  }

  extend type Query {
    achievements(active: Boolean): [Achievement!]!
    myAchievements: [UserAchievement!]!
    userAchievements(userId: ID!): [UserAchievement!]!
    achievement(id: ID, code: String): Achievement
  }

  extend type Mutation {
    addAchievement(input: AchievementInput!): Achievement!
    editAchievement(id: ID!, input: AchievementInput!): Achievement!
    deleteAchievement(id: ID!): Boolean!
    grantAchievement(userId: ID!, achievementCode: String!, meta: JSON): UserAchievement
    revokeAchievement(userId: ID!, achievementCode: String!): Boolean!
  }
`;
