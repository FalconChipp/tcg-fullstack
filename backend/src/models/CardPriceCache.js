// src/models/CardPriceCache.js — ESM factory
import { DataTypes } from 'sequelize';

const CardPriceCacheFactory = (sequelize) => {
  const CardPriceCache = sequelize.define(
    'CardPriceCache',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      cardId: { type: DataTypes.STRING, allowNull: false },
      tcgplayer: { type: DataTypes.JSON, allowNull: true },
      cardmarket: { type: DataTypes.JSON, allowNull: true },
      lastFetched: { type: DataTypes.DATE, allowNull: true },
    },
    {
      tableName: 'card_price_cache',
      underscored: false,
      timestamps: true,
      indexes: [{ unique: true, fields: ['cardId'] }],
    }
  );

  return CardPriceCache;
};

export default CardPriceCacheFactory;
