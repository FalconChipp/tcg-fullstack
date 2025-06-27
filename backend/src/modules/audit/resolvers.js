import { AuditLog, User } from '../../models/index.js';
import { requireAdmin } from '../users/helpers.js';

const DEFAULT_PAGE_SIZE = 50;

const resolvers = {
  Query: {
    auditLogs: async (
      _,
      { userId, action, targetId, targetType, page = 1, pageSize = DEFAULT_PAGE_SIZE },
      { token }
    ) => {
      requireAdmin(token);
      const where = {};
      if (userId) where.userId = userId;
      if (action) where.action = action;
      if (targetId) where.targetId = targetId;
      if (targetType) where.targetType = targetType;
      return AuditLog.findAll({
        where,
        order: [['createdAt', 'DESC']],
        offset: (page - 1) * pageSize,
        limit: pageSize,
      });
    },
  },
  AuditLog: {
    user: (log) => (log.userId ? User.findByPk(log.userId) : null),
  },
};

export default resolvers;
