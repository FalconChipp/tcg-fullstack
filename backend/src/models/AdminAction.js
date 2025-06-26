// src/models/AdminAction.js

import { DataTypes, Model } from 'sequelize';

/**
 * Factory function for AdminAction model.
 * Do NOT import other models here; set up associations in index.js only!
 *
 * @param {Sequelize} sequelize - the sequelize instance
 * @returns {Model} AdminAction model
 */
export default (sequelize) => {
  class AdminAction extends Model {}

  AdminAction.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      adminId: {
        // The admin who performed the action
        type: DataTypes.UUID,
        allowNull: false,
        // references: { model: 'users', key: 'id' }, // Associations are done in index.js
        // onDelete: 'CASCADE',
      },
      targetUserId: {
        // The user affected (could be null for system-wide actions)
        type: DataTypes.UUID,
        allowNull: true,
        // references: { model: 'users', key: 'id' },
        // onDelete: 'CASCADE',
      },
      actionType: {
        // 'ban', 'remove_listing', 'delete_message', etc.
        type: DataTypes.STRING,
        allowNull: false,
      },
      reason: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      details: {
        // Extra JSON data (listingId, tradeId, etc)
        type: DataTypes.JSON,
        allowNull: true,
      },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'AdminAction',
      tableName: 'admin_actions',
      timestamps: true,
      indexes: [
        { fields: ['adminId'] },
        { fields: ['targetUserId'] },
        { fields: ['actionType'] }
      ]
    }
  );

  return AdminAction;
};
