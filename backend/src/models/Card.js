// src/models/Card.js

import { DataTypes, Model } from 'sequelize';

/**
 * Factory function for Card model.
 * Do NOT import sequelize or other models directly here;
 * pass sequelize from the models/index.js loader.
 *
 * @param {Sequelize} sequelize - the sequelize instance
 * @returns {Model} Card model
 */
export default (sequelize) => {
  class Card extends Model {}

  Card.init(
    {
      id: { // Primary key, e.g. 'sv08-238'
        type: DataTypes.STRING,
        primaryKey: true,
      },
      name: { type: DataTypes.STRING, allowNull: false },
      number: { type: DataTypes.STRING, allowNull: false },
      set: { type: DataTypes.STRING, allowNull: false },         // Set code, e.g. 'sv08'
      setName: { type: DataTypes.STRING, allowNull: true },
      setLogo: { type: DataTypes.STRING, allowNull: true },
      setSymbol: { type: DataTypes.STRING, allowNull: true },
      edition: { type: DataTypes.STRING, allowNull: true },      // e.g. 1st Edition, Unlimited
      image: { type: DataTypes.STRING, allowNull: true },        // Base card image url
      rarity: { type: DataTypes.STRING, allowNull: true },
      variations: { type: DataTypes.TEXT, allowNull: true },     // JSON string/array: [holo, reverse, etc]
      pricing: { type: DataTypes.TEXT, allowNull: true },        // JSON blob from TCG APIs
      tcgplayerVariations: { type: DataTypes.TEXT, allowNull: true }, // Pricing variants
      cardmarketVariations: { type: DataTypes.TEXT, allowNull: true },
      // Common fields for search
      tcgplayerLow: { type: DataTypes.FLOAT, allowNull: true },
      tcgplayerMid: { type: DataTypes.FLOAT, allowNull: true },
      tcgplayerHigh: { type: DataTypes.FLOAT, allowNull: true },
      tcgplayerMarket: { type: DataTypes.FLOAT, allowNull: true },
      tcgplayerDirectLow: { type: DataTypes.FLOAT, allowNull: true },
      cardmarketAverageSell: { type: DataTypes.FLOAT, allowNull: true },
      cardmarketLowPrice: { type: DataTypes.FLOAT, allowNull: true },
      cardmarketTrendPrice: { type: DataTypes.FLOAT, allowNull: true },

      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'Card',
      tableName: 'cards',
      timestamps: true,
    }
  );

  return Card;
};
