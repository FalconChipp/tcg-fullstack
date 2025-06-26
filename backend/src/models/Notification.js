// src/models/Notification.js

import { DataTypes, Model } from 'sequelize';

/**
 * Notification model factory.
 * @param {Sequelize} sequelize
 * @param {Object} models - All models, e.g. { User }
 * @returns {Model}
 */
export default (sequelize, models) => {
  class Notification extends Model {}

  Notification.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        // Optional if broadcast notification
        type: DataTypes.UUID,
        allowNull: true,
      },
      type: {
        // 'system', 'trade_offer', 'trade_complete', 'message', etc
        type: DataTypes.STRING,
        allowNull: false,
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      body: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      iconUrl: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      linkUrl: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      isRead: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      isDismissed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      meta: {
        // Extra info as JSON (e.g. tradeId, listingId)
        type: DataTypes.JSON,
        allowNull: true,
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      isSilent: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      isBroadcast: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      emailSentAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'Notification',
      tableName: 'notifications',
      timestamps: true,
      indexes: [
        { fields: ['userId'] },
        { fields: ['type'] },
        { fields: ['isRead'] },
        { fields: ['isDismissed'] },
        { fields: ['expiresAt'] },
      ],
    }
  );

  // --- Associations ---
  Notification.associate = (models) => {
    Notification.belongsTo(models.User, { foreignKey: 'userId' });
    models.User.hasMany(Notification, { foreignKey: 'userId', onDelete: 'CASCADE' });
  };

  return Notification;
};
