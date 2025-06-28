// src/schema.js

import { mergeTypeDefs } from '@graphql-tools/merge';
import { mergeResolvers } from '@graphql-tools/merge';

// ---- Import typeDefs from all modules ----
import authTypeDefs from './modules/auth/typeDefs.js';
import usersTypeDefs from './modules/users/typeDefs.js';
import searchTypeDefs from './modules/search/typeDefs.js';
import collectionsTypeDefs from './modules/collection/typeDefs.js';
import wishlistTypeDefs from './modules/wishlist/typeDefs.js';
import achievementsTypeDefs from './modules/achievements/typeDefs.js';
import rewardsTypeDefs from './modules/rewards/typeDefs.js';
import auditTypeDefs from './modules/audit/typeDefs.js';
import marketplaceTypeDefs from './modules/marketplace/typeDefs.js';
import tradingTypeDefs from './modules/trading/typeDefs.js';
import bindersTypeDefs from './modules/binders/typeDefs.js';
import messagesTypeDefs from './modules/messages/typeDefs.js';
import notificationsTypeDefs from './modules/notifications/typeDefs.js';
import subscriptionsTypeDefs from './modules/subscriptions/typeDefs.js';
import shippingTypeDefs from './modules/shipping/typeDefs.js';

// ---- Import resolvers from all modules ----
import authResolvers from './modules/auth/resolvers.js';
import usersResolvers from './modules/users/resolvers.js';
import searchResolvers from './modules/search/resolvers.js';
import collectionsResolvers from './modules/collection/resolvers.js';
import wishlistResolvers from './modules/wishlist/resolvers.js';
import achievementsResolvers from './modules/achievements/resolvers.js';
import rewardsResolvers from './modules/rewards/resolvers.js';
import auditResolvers from './modules/audit/resolvers.js';
import marketplaceResolvers from './modules/marketplace/resolvers.js';
import tradingResolvers from './modules/trading/resolvers.js';
import bindersResolvers from './modules/binders/resolvers.js';
import messagesResolvers from './modules/messages/resolvers.js';
import notificationsResolvers from './modules/notifications/resolvers.js';
import subscriptionsResolvers from './modules/subscriptions/resolvers.js';
import shippingResolvers from './modules/shipping/resolvers.js';

// ---- Merge all typeDefs ----
export const typeDefs = mergeTypeDefs([
  authTypeDefs,
  usersTypeDefs,
  searchTypeDefs,
  collectionsTypeDefs,
  marketplaceTypeDefs,
  tradingTypeDefs,
  bindersTypeDefs,
  wishlistTypeDefs,
  achievementsTypeDefs,
  rewardsTypeDefs,
  auditTypeDefs,
  messagesTypeDefs,
  notificationsTypeDefs,
  subscriptionsTypeDefs,
  shippingTypeDefs,
]);

// ---- Merge all resolvers ----
export const resolvers = mergeResolvers([
  authResolvers,
  usersResolvers,
  searchResolvers,
  collectionsResolvers,
  marketplaceResolvers,
  tradingResolvers,
  bindersResolvers,
  wishlistResolvers,
  achievementsResolvers,
  rewardsResolvers,
  auditResolvers,
  messagesResolvers,
  notificationsResolvers,
  subscriptionsResolvers,
  shippingResolvers,
]);
