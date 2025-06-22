// Combines all modules' typeDefs and resolvers
const { makeExecutableSchema } = require('@graphql-tools/schema');
const { mergeTypeDefs, mergeResolvers } = require('@graphql-tools/merge');

// Import modules
const achievements = require('./modules/achievements');
const auth = require('./modules/auth');
const binders = require('./modules/binders');
const marketplace = require('./modules/marketplace');
const search = require('./modules/search');
const collections = require('./modules/collections');
const userProfiles = require('./modules/userProfiles');
const subscriptions = require('./modules/subscriptions');
const admin = require('./modules/admin');

const typeDefs = mergeTypeDefs([
  achievements.typeDefs,
  auth.typeDefs,
  binders.typeDefs,
  marketplace.typeDefs,
  search.typeDefs,
  collections.typeDefs,
  userProfiles.typeDefs,
  subscriptions.typeDefs,
  admin.typeDefs,
]);

const resolvers = mergeResolvers([
  achievements.resolvers,
  auth.resolvers,
  binders.resolvers,
  marketplace.resolvers,
  search.resolvers,
  collections.resolvers,
  userProfiles.resolvers,
  subscriptions.resolvers,
  admin.resolvers,
]);

module.exports = makeExecutableSchema({ typeDefs, resolvers });
