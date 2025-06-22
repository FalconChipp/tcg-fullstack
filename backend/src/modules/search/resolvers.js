// src/modules/search/resolvers.js
const { Card } = require('../../models');
const helpers = require('./helpers');

module.exports = {
  Query: {
    searchCards: async (parent, args) => {
      return await helpers.searchCards(args);
    },
    getCard: async (parent, { id }) => {
      // Check cache first
      let card = await Card.findByPk(id);
      if (!card) {
        // Fetch and cache if not found
        card = await helpers.fetchCardById(id);
        if (card) await Card.upsert(card);
      }
      return card;
    }
  }
};
