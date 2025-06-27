import { gql } from 'graphql-tag';

export default gql`
  type Reward {
    id: ID!
    userId: ID!
    type: String!
    achievementId: ID
    data: JSON
    createdAt: String
    achievement: Achievement
  }

  extend type Query {
    myRewards: [Reward!]!
    userRewards(userId: ID!): [Reward!]!
  }

  extend type Mutation {
    grantReward(userId: ID!, type: String!, achievementId: ID, data: JSON): Reward!
  }
`;
