// src/models/CardPriceCache.js

import { DataTypes, Model } from 'sequelize';

/**
 * CardPriceCache model factory.
 * Pass in the sequelize instance from the loader.
 */
export default (sequelize) => {
  class CardPriceCache extends Model {}

  CardPriceCache.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      cardId: {
        // Matches Card.id
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      tcgplayer: {
        // JSON blob: { market, low, high, mid, direct_low }
        type: DataTypes.JSON,
        allowNull: true,
      },
      cardmarket: {
        // JSON blob: { trend, low, average_sell }
        type: DataTypes.JSON,
        allowNull: true,
      },
      lastFetched: {
        // When prices were last fetched
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'CardPriceCache',
      tableName: 'card_price_cache',
      timestamps: true,
      indexes: [
        { fields: ['cardId'], unique: true }
      ]
    }
  );

  return CardPriceCache;
};
