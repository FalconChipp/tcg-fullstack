// src/models/UserReputation.js

import { DataTypes, Model } from 'sequelize';

export default (sequelize) => {
  class UserReputation extends Model {}

  UserReputation.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true,
        // associations defined in models/index.js
      },
      score: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      positive: { type: DataTypes.INTEGER, defaultValue: 0 },
      negative: { type: DataTypes.INTEGER, defaultValue: 0 },
      neutral: { type: DataTypes.INTEGER, defaultValue: 0 },
      completedTrades: { type: DataTypes.INTEGER, defaultValue: 0 },
      completedMarketplace: { type: DataTypes.INTEGER, defaultValue: 0 },
      flagged: { type: DataTypes.BOOLEAN, defaultValue: false },
      banReason: { type: DataTypes.STRING, allowNull: true },
      lastUpdated: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'UserReputation',
      tableName: 'user_reputations',
      timestamps: true,
      indexes: [
        { fields: ['userId'] },
        { fields: ['score'] },
        { fields: ['flagged'] },
      ],
    }
  );

  // No associations here! Do them in models/index.js

  return UserReputation;
};
