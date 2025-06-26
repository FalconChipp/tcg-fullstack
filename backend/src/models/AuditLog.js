// src/models/AuditLog.js

import { DataTypes, Model } from 'sequelize';

/**
 * Factory function for AuditLog model.
 * Do NOT import other models here; set up associations in index.js only!
 *
 * @param {Sequelize} sequelize - the sequelize instance
 * @returns {Model} AuditLog model
 */
export default (sequelize) => {
  class AuditLog extends Model {}

  AuditLog.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        // User that performed the action (can be null for system)
        type: DataTypes.UUID,
        allowNull: true,
        // references: { model: 'users', key: 'id' }, // Relations set up in index.js
        // onDelete: 'SET NULL',
      },
      action: {
        // e.g. 'USER_BAN', 'LISTING_REMOVED', 'LOGIN', 'ADMIN_OVERRIDE'
        type: DataTypes.STRING,
        allowNull: false,
      },
      targetId: {
        // UUID or string. User, card, listing, etc (context-dependent)
        type: DataTypes.STRING,
        allowNull: true,
      },
      targetType: {
        // 'User', 'Listing', 'Trade', 'Collection', etc
        type: DataTypes.STRING,
        allowNull: true,
      },
      details: {
        // JSON object, flexible for storing arbitrary data
        type: DataTypes.JSON,
        allowNull: true,
      },
      ip: {
        // Optional: log IP of request, if available
        type: DataTypes.STRING,
        allowNull: true,
      },
      userAgent: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'AuditLog',
      tableName: 'audit_logs',
      timestamps: true,
      indexes: [
        { fields: ['userId'] },
        { fields: ['action'] },
        { fields: ['targetId'] },
        { fields: ['targetType'] },
        { fields: ['createdAt'] }
      ]
    }
  );

  return AuditLog;
};
