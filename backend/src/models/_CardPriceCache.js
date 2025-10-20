// src/models/CardPriceCache.js — ESM factory

// CHANGED: normalized cache rows per provider/variation for deterministic pricing
import { DataTypes } from 'sequelize';

const CardPriceCacheFactory = (sequelize) => {
  const CardPriceCache = sequelize.define(
    'CardPriceCache',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      cardId: { type: DataTypes.STRING(64), allowNull: false },
      provider: { type: DataTypes.STRING(32), allowNull: true },
      currency: { type: DataTypes.STRING(8), allowNull: true, defaultValue: 'GBP' },
      gbp: { type: DataTypes.FLOAT, allowNull: true },
      market: { type: DataTypes.FLOAT, allowNull: true },
      mid: { type: DataTypes.FLOAT, allowNull: true },
      low: { type: DataTypes.FLOAT, allowNull: true },
      high: { type: DataTypes.FLOAT, allowNull: true },
      variation: { type: DataTypes.STRING(64), allowNull: true },
    },
    {
      tableName: 'card_price_cache',
      underscored: false,
      timestamps: true,
      indexes: [
        { fields: ['cardId'] },
        { fields: ['cardId', 'variation'] },
        { fields: ['cardId', 'provider'] },
      ],
    }
  );

  return CardPriceCache;
};

export default CardPriceCacheFactory;
