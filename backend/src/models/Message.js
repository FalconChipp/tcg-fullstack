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
      ],
    }
  );

  // Associations
  Message.associate = (models) => {
    Message.belongsTo(models.User, { foreignKey: 'senderId', as: 'sender' });
    Message.belongsTo(models.User, { foreignKey: 'receiverId', as: 'receiver' });

    models.User.hasMany(Message, { foreignKey: 'senderId', as: 'sentMessages' });
    models.User.hasMany(Message, { foreignKey: 'receiverId', as: 'receivedMessages' });
  };

  return Message;
};
