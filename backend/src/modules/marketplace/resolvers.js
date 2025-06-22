// src/modules/marketplace/resolvers.js
const { MarketplaceListing, Card, User } = require('../../models');
const helpers = require('../auth/helpers');
const { Op } = require('sequelize');

module.exports = {
  Query: {
    marketplaceListings: async (parent, { cardId, status, limit, offset }) => {
      const where = {};
      if (cardId) where.cardId = cardId;
      if (status) where.status = status;
      return await MarketplaceListing.findAll({
        where,
        limit,
        offset,
        order: [['createdAt', 'DESC']]
      });
    },
    myMarketplaceListings: async (parent, args, context) => {
      if (!context.token) throw new Error('Not authenticated');
      const payload = helpers.verifyJwt(context.token.replace('Bearer ', ''));
      return await MarketplaceListing.findAll({
        where: { userId: payload.id },
        order: [['createdAt', 'DESC']]
      });
    },
    marketplaceListing: async (parent, { id }) =>
      await MarketplaceListing.findByPk(id),
  },
  Mutation: {
    createMarketplaceListing: async (parent, { cardId, quantity, price }, context) => {
      if (!context.token) throw new Error('Not authenticated');
      const payload = helpers.verifyJwt(context.token.replace('Bearer ', ''));
      // Optionally: check user owns enough in their collection
      return await MarketplaceListing.create({
        userId: payload.id,
        cardId,
        quantity,
        price,
        status: 'listed'
      });
    },
    updateMarketplaceListing: async (parent, { id, quantity, price, status }, context) => {
      if (!context.token) throw new Error('Not authenticated');
      const payload = helpers.verifyJwt(context.token.replace('Bearer ', ''));
      const listing = await MarketplaceListing.findByPk(id);
      if (!listing) throw new Error('Listing not found');
      if (listing.userId !== payload.id) throw new Error('No permission');
      if (quantity !== undefined) listing.quantity = quantity;
      if (price !== undefined) listing.price = price;
      if (status !== undefined) listing.status = status;
      await listing.save();
      return listing;
    },
    removeMarketplaceListing: async (parent, { id }, context) => {
      if (!context.token) throw new Error('Not authenticated');
      const payload = helpers.verifyJwt(context.token.replace('Bearer ', ''));
      const listing = await MarketplaceListing.findByPk(id);
      if (!listing) throw new Error('Listing not found');
      if (listing.userId !== payload.id) throw new Error('No permission');
      await listing.destroy();
      return true;
    },
    markMarketplaceListingSold: async (parent, { id }, context) => {
      if (!context.token) throw new Error('Not authenticated');
      const payload = helpers.verifyJwt(context.token.replace('Bearer ', ''));
      const listing = await MarketplaceListing.findByPk(id);
      if (!listing) throw new Error('Listing not found');
      if (listing.userId !== payload.id) throw new Error('No permission');
      listing.status = 'sold';
      await listing.save();
      return listing;
    }
  },
  MarketplaceListing: {
    card: async (listing) => await Card.findByPk(listing.cardId),
    seller: async (listing) => await User.findByPk(listing.userId)
  }
};
