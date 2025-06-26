// src/models/ChatAgreement.js
import { DataTypes, Model } from 'sequelize';

export default (sequelize) => {
  class ChatAgreement extends Model {}

  ChatAgreement.init(
    {
      userId: {
        type: DataTypes.UUID,
        primaryKey: true,
        allowNull: false,
      },
      agreedAt: { type: DataTypes.DATE, allowNull: false },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'ChatAgreement',
      tableName: 'chat_agreements',
      timestamps: true,
      indexes: [{ fields: ['userId'] }],
    }
  );

  return ChatAgreement;
};
