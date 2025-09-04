// Card.js — ESM Sequelize model factory (self-contained)
/**
 * Usage in models/index.js:
 *   import CardFactory from './Card.js';
 *   const Card = CardFactory(sequelize);
 */
import { DataTypes } from 'sequelize';

const CardFactory = (sequelize) => {
  const Card = sequelize.define(
    'Card',
    {
      id: { type: DataTypes.STRING, primaryKey: true },
      name: DataTypes.STRING,
      number: DataTypes.STRING,
      set: DataTypes.STRING,
      setName: DataTypes.STRING,
      setLogo: DataTypes.STRING,
      setSymbol: DataTypes.STRING,
      edition: DataTypes.STRING,
      image: DataTypes.STRING,
      rarity: DataTypes.STRING,
      variations: DataTypes.JSON,
      pricing: DataTypes.JSON,
      tcgplayerVariations: DataTypes.JSON,
      cardmarketVariations: DataTypes.JSON,
      tcgplayerLow: DataTypes.FLOAT,
      tcgplayerMid: DataTypes.FLOAT,
      tcgplayerHigh: DataTypes.FLOAT,
      tcgplayerMarket: DataTypes.FLOAT,
      tcgplayerDirectLow: DataTypes.FLOAT,
      cardmarketAverageSell: DataTypes.FLOAT,
      cardmarketLowPrice: DataTypes.FLOAT,
      cardmarketTrendPrice: DataTypes.FLOAT,
    },
    {
      tableName: 'cards',
      underscored: false,
      timestamps: true,
      indexes: [
        { fields: ['set', 'number'] },
        { fields: ['name'] },
      ],
    }
  );

  return Card;
};

export default CardFactory;
