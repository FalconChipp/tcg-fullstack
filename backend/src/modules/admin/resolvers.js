const { User, Binder, Card, MarketplaceListing, Admin } = require('../../models');
const helpers = require('../auth/helpers');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

function requireAdmin(context) {
  if (!context.token) throw new Error('Not authenticated');
  const payload = helpers.getAdminFromToken(context.token);
  if (!payload || !payload.adminId) throw new Error('Admin only');
}

module.exports = {
  Query: {
    adminUsers: async (parent, { limit, offset }, context) => {
      requireAdmin(context);
      return await User.findAll({ limit, offset, order: [['createdAt', 'DESC']] });
    },
    adminBinders: async (parent, { limit, offset }, context) => {
      requireAdmin(context);
      return await Binder.findAll({ limit, offset, order: [['createdAt', 'DESC']] });
    },
    adminCards: async (parent, { limit, offset }, context) => {
      requireAdmin(context);
      return await Card.findAll({ limit, offset, order: [['name', 'ASC']] });
    },
    adminMarketplaceListings: async (parent, { limit, offset }, context) => {
      requireAdmin(context);
      return await MarketplaceListing.findAll({ limit, offset, order: [['createdAt', 'DESC']] });
    }
  },
  Mutation: {
    adminLogin: async (parent, { email, password }) => {
      const admin = await Admin.findOne({ where: { email } });
      if (!admin) throw new Error('Invalid credentials');
      const valid = await bcrypt.compare(password, admin.password);
      if (!valid) throw new Error('Invalid credentials');
      const token = jwt.sign({ adminId: admin.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
      return { token, admin };
    },
    adminDeleteBinder: async (parent, { id }, context) => {
      requireAdmin(context);
      const binder = await Binder.findByPk(id);
      if (!binder) return false;
      await binder.destroy();
      return true;
    },
    adminDeleteCard: async (parent, { id }, context) => {
      requireAdmin(context);
      const card = await Card.findByPk(id);
      if (!card) return false;
      await card.destroy();
      return true;
    },
    adminDeleteMarketplaceListing: async (parent, { id }, context) => {
      requireAdmin(context);
      const listing = await MarketplaceListing.findByPk(id);
      if (!listing) return false;
      await listing.destroy();
      return true;
    }
  }
};
