// src/modules/search/resolvers.js
const helpers = require('./helpers');

module.exports = {
  Query: {
    searchCards: async (parent, args) => {
      // Pass fullData (default true)
      return await helpers.searchCards(args, args.fullData !== false);
    },
    getCard: async (parent, { id }) => {
      return await helpers.getCardById(id);
    }
  }
};
