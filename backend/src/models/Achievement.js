// src/models/Achievement.js

import { DataTypes, Model } from 'sequelize';

/**
 * Factory function for the Achievement model.
 * This prevents circular import issues and allows model association setup in index.js.
 * 
 * @param {Sequelize} sequelize - The sequelize instance
 * @returns {Model} Achievement model
 */
export default (sequelize) => {
  class Achievement extends Model {}

  Achievement.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      code: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true, // e.g. 'pre_signup', 'first_trade', etc.
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      description: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      tier: {
        type: DataTypes.STRING,
        allowNull: true, // 'gold', 'silver', 'bronze', etc.
      },
      iconUrl: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      points: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'Achievement',
      tableName: 'achievements',
      timestamps: true,
      indexes: [{ fields: ['code'], unique: true }],
    }
  );

  return Achievement;
};
