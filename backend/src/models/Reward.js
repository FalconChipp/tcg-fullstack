// src/models/Reward.js
import { DataTypes, Model } from 'sequelize';

export default (sequelize) => {
  class Reward extends Model {}

  Reward.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      type: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      achievementId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      data: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'Reward',
      tableName: 'rewards',
      timestamps: true,
      indexes: [
        { fields: ['userId'] },
        { fields: ['type'] },
        { fields: ['achievementId'] },
      ],
    }
  );

  return Reward;
};
