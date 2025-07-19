// src/models/UserAchievement.js

import { DataTypes, Model } from 'sequelize';

// Do NOT import sequelize, User, or Achievement here!

export default (sequelize) => {
  class UserAchievement extends Model {}

  UserAchievement.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        // Foreign keys & associations are handled in models/index.js
      },
      achievementId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      earnedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      meta: {
        type: DataTypes.JSON,
        allowNull: true, // Context info, e.g. { tradeId, description }
      },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'UserAchievement',
      tableName: 'user_achievements',
      timestamps: true,
      indexes: [
        { fields: ['userId'] },
        { fields: ['achievementId'] },
        { fields: ['userId', 'achievementId'], unique: true },
      ],
    }
  );

  return UserAchievement;
};
