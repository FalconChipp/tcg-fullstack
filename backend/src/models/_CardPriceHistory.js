// src/models/CardPriceHistory.js — ESM factory (default export)

// CHANGED: structured history rows for rollup aggregation
import { DataTypes } from 'sequelize';

const CardPriceHistoryFactory = (sequelize) => {
  const CardPriceHistory = sequelize.define(
    'CardPriceHistory',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      cardId: {
        type: DataTypes.STRING(64),
        allowNull: false,
      },
      variation: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      provider: { type: DataTypes.STRING(32), allowNull: true },
      currency: { type: DataTypes.STRING(8), allowNull: true, defaultValue: 'GBP' },
      gbp: { type: DataTypes.FLOAT, allowNull: true },
      market: { type: DataTypes.FLOAT, allowNull: true },
      mid: { type: DataTypes.FLOAT, allowNull: true },
      low: { type: DataTypes.FLOAT, allowNull: true },
      high: { type: DataTypes.FLOAT, allowNull: true },
    },
    {
      tableName: 'card_price_history',
      underscored: false,
      timestamps: true,
      indexes: [
        { fields: ['cardId'] },
        { fields: ['cardId', 'variation'] },
        { fields: ['cardId', 'updatedAt'] },
      ],
    }
  );

  return CardPriceHistory;
};

export default CardPriceHistoryFactory;
