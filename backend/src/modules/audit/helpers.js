import { AuditLog } from '../../models/index.js';

/**
 * Record an audit log entry
 * @param {Object} params
 * @param {string|null} params.userId - User performing the action
 * @param {string} params.action - Action code
 * @param {string|null} params.targetId - Target entity id
 * @param {string|null} params.targetType - Target entity type
 * @param {Object|null} params.details - Additional details
 * @param {string|null} params.ip - Request IP
 * @param {string|null} params.userAgent - User agent string
 */
export async function recordAuditLog({
  userId = null,
  action,
  targetId = null,
  targetType = null,
  details = null,
  ip = null,
  userAgent = null,
}) {
  return AuditLog.create({
    userId,
    action,
    targetId,
    targetType,
    details,
    ip,
    userAgent,
  });
}
