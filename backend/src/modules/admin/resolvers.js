// src/modules/admin/resolvers.js

import { verifyJwt } from '../auth/helpers.js';
import { requireAdmin } from '../users/helpers.js';

export default {
  Query: {
    adminStats: async (_, __, { models, token }) => {
      // --- Permissions: Require admin, using your existing helper ---
      await requireAdmin(token);

      // --- Optionally, get the user object if you want to log or check something else ---
      let userId;
      try {
        const payload = verifyJwt(token);
        userId = payload.id;
      } catch {
        // Not strictly needed, requireAdmin will throw if not valid
        userId = null;
      }

      // --- Gather stats in parallel ---
      const [
        totalUsers,
        totalActiveUsers,
        totalListings,
        totalCards,
        totalTrades,
        totalBanned
      ] = await Promise.all([
        models.User.count(),
        models.User.count({ where: { isBanned: false } }),
        models.Listing.count(),
        models.Card.count(),
        models.Trade.count(),
        models.User.count({ where: { isBanned: true } }),
      ]);

      return {
        totalUsers,
        totalActiveUsers,
        totalListings,
        totalCards,
        totalTrades,
        totalBanned,
      };
    },
  },
};
