// src/models/Message.js

import { DataTypes, Model } from 'sequelize';

/**
 * Message model factory
 * @param {Sequelize} sequelize
 * @param {Object} models - All models, e.g. { User }
 * @returns {Model}
 */
export default (sequelize, models) => {
  class Message extends Model {}

  Message.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      senderId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      receiverId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      content: { type: DataTypes.TEXT, allowNull: false },
      isRead: { type: DataTypes.BOOLEAN, defaultValue: false },
      deletedBySender: { type: DataTypes.BOOLEAN, defaultValue: false },
      deletedByReceiver: { type: DataTypes.BOOLEAN, defaultValue: false },
      meta: { type: DataTypes.JSON, allowNull: true },
      isFlagged: { type: DataTypes.BOOLEAN, defaultValue: false },
      flagReason: { type: DataTypes.STRING, allowNull: true },
      flaggedById: { type: DataTypes.UUID, allowNull: true },
      expiresAt: { type: DataTypes.DATE, allowNull: true }, // optional auto delete
      isSystemMessage: { type: DataTypes.BOOLEAN, defaultValue: false },
      reminderSentAt: { type: DataTypes.DATE, allowNull: true },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'Message',
      tableName: 'messages',
      timestamps: true,
      indexes: [
        { fields: ['senderId'] },
        { fields: ['receiverId'] },
        { fields: ['createdAt'] },
        { fields: ['flaggedById'] },
        { fields: ['isFlagged'] },
        { fields: ['expiresAt'] },
        { fields: ['isSystemMessage'] },
        { fields: ['reminderSentAt'] },
      ],
    }
  );

  // Cleanup of expired messages handled in src/jobs/messageCleanup.js

  // Associations
  Message.associate = (models) => {
    Message.belongsTo(models.User, { foreignKey: 'senderId', as: 'sender' });
    Message.belongsTo(models.User, { foreignKey: 'receiverId', as: 'receiver' });
    Message.belongsTo(models.User, { foreignKey: 'flaggedById', as: 'flaggedBy' });

    models.User.hasMany(Message, { foreignKey: 'senderId', as: 'sentMessages' });
    models.User.hasMany(Message, { foreignKey: 'receiverId', as: 'receivedMessages' });
  };

  return Message;
};
