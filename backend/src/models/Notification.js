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
        // Who the notification is for
        type: DataTypes.UUID,
        allowNull: false,
      },
      type: {
        // 'trade', 'purchase', 'admin', 'message', 'system', etc
        type: DataTypes.STRING,
        allowNull: false,
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      body: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      data: {
        // Extra info as JSON (e.g. tradeId, listingId)
        type: DataTypes.JSON,
        allowNull: true,
      },
      isRead: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
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
