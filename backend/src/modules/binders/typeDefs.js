import { gql } from 'graphql-tag';

export default gql`
  type Binder {
    id: ID!
    userId: ID!
    name: String!
    description: String
    coverImage: String
    accentColor: String
    visibility: String!
    slug: String!
    createdAt: String
    updatedAt: String
    pages: [BinderPage!]
  }

  type BinderPage {
    id: ID!
    binderId: ID!
    title: String
    layout: String!
    pageOrder: Int!
    createdAt: String
    updatedAt: String
    slots: [BinderSlot!]
  }

  type BinderSlot {
    id: ID!
    pageId: ID!
    cardId: String!
    quantity: Int!
    position: Int!
    notes: String
    card: Card
  }

  input BinderInput {
    name: String
    description: String
    accentColor: String
    visibility: String
  }

  input BinderPageInput {
    title: String
    layout: String
    pageOrder: Int
  }

  input BinderSlotInput {
    cardId: String!
    quantity: Int
    position: Int!
    notes: String
  }

  type BinderPageResult {
    binders: [Binder!]!
    total: Int!
    page: Int!
    pageSize: Int!
  }

  extend type Query {
    myBinders: [Binder!]!
    binder(id: ID!, slug: String): Binder
    browseBinders(page: Int, pageSize: Int, userId: ID, search: String): BinderPageResult!
  }

  extend type Mutation {
    createBinder(input: BinderInput!): Binder!
    updateBinder(id: ID!, input: BinderInput!): Binder!
    deleteBinder(id: ID!, permanent: Boolean): Boolean!

    addBinderPage(binderId: ID!, input: BinderPageInput!): BinderPage!
    updateBinderPage(id: ID!, input: BinderPageInput!): BinderPage!
    deleteBinderPage(id: ID!): Boolean!

    addCardToBinder(pageId: ID!, input: BinderSlotInput!): BinderSlot!
    updateBinderSlot(id: ID!, input: BinderSlotInput!): BinderSlot!
    moveBinderSlot(id: ID!, pageId: ID!, position: Int!): BinderSlot!
    removeBinderSlot(id: ID!): Boolean!

    uploadBinderCover(id: ID!, image: String!): String!

    adminEditBinder(id: ID!, input: BinderInput!): Binder!
    adminDeleteBinder(id: ID!, permanent: Boolean): Boolean!
  }
`;
