// src/schema.js

import { mergeTypeDefs } from '@graphql-tools/merge';
import { mergeResolvers } from '@graphql-tools/merge';

// ---- Import typeDefs from all modules ----
import authTypeDefs from './modules/auth/typeDefs.js';
import usersTypeDefs from './modules/users/typeDefs.js';
import searchTypeDefs from './modules/search/typeDefs.js';
import collectionsTypeDefs from './modules/collection/typeDefs.js';
// import listingsTypeDefs from './modules/listings/typeDefs.js';
// import tradesTypeDefs from './modules/trades/typeDefs.js';
// import wishlistTypeDefs from './modules/wishlist/typeDefs.js';
import achievementsTypeDefs from './modules/achievements/typeDefs.js';
// import reputationTypeDefs from './modules/reputation/typeDefs.js';
// import messagesTypeDefs from './modules/messages/typeDefs.js';
// import notificationsTypeDefs from './modules/notifications/typeDefs.js';
// import subscriptionsTypeDefs from './modules/subscriptions/typeDefs.js';
// import transactionsTypeDefs from './modules/transactions/typeDefs.js';
// import shippingTypeDefs from './modules/shipping/typeDefs.js';
// import adminTypeDefs from './modules/admin/typeDefs.js';

// ---- Import resolvers from all modules ----
import authResolvers from './modules/auth/resolvers.js';
import usersResolvers from './modules/users/resolvers.js';
import searchResolvers from './modules/search/resolvers.js';
import collectionsResolvers from './modules/collection/resolvers.js';
// import listingsResolvers from './modules/listings/resolvers.js';
// import tradesResolvers from './modules/trades/resolvers.js';
// import wishlistResolvers from './modules/wishlist/resolvers.js';
import achievementsResolvers from './modules/achievements/resolvers.js';
// import reputationResolvers from './modules/reputation/resolvers.js';
// import messagesResolvers from './modules/messages/resolvers.js';
// import notificationsResolvers from './modules/notifications/resolvers.js';
// import subscriptionsResolvers from './modules/subscriptions/resolvers.js';
// import transactionsResolvers from './modules/transactions/resolvers.js';
// import shippingResolvers from './modules/shipping/resolvers.js';
// import adminResolvers from './modules/admin/resolvers.js';

// ---- Merge all typeDefs ----
export const typeDefs = mergeTypeDefs([
  authTypeDefs,
  usersTypeDefs,
  searchTypeDefs,
  collectionsTypeDefs,
//   listingsTypeDefs,
//   tradesTypeDefs,
//   wishlistTypeDefs,
  achievementsTypeDefs,
//   reputationTypeDefs,
//   messagesTypeDefs,
//   notificationsTypeDefs,
//   subscriptionsTypeDefs,
//   transactionsTypeDefs,
//   shippingTypeDefs,
//   adminTypeDefs,
]);

// ---- Merge all resolvers ----
export const resolvers = mergeResolvers([
  authResolvers,
  usersResolvers,
  searchResolvers,
  collectionsResolvers,
// listingsResolvers,
//   tradesResolvers,
//   wishlistResolvers,
  achievementsResolvers,
//   reputationResolvers,
//   messagesResolvers,
//   notificationsResolvers,
//   subscriptionsResolvers,
//   transactionsResolvers,
//   shippingResolvers,
//   adminResolvers,
]);
