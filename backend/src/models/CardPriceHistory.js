// src/models/CardPriceHistory.js — ESM factory (default export)

// --- DEPRECATED --- 
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
        type: DataTypes.STRING,
        allowNull: false,
      },
      variation: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      tcgplayer: { type: DataTypes.JSON, allowNull: true },
      cardmarket: { type: DataTypes.JSON, allowNull: true },
      gbp: { type: DataTypes.FLOAT, allowNull: true },
      currency: { type: DataTypes.STRING, allowNull: true, defaultValue: 'GBP' },
      fetchedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      tableName: 'card_price_history',
      underscored: false,
      timestamps: true, // keeps createdAt/updatedAt alongside fetchedAt
      indexes: [
        { fields: ['cardId'] },
        { fields: ['cardId', 'variation', 'fetchedAt'] },
      ],
    }
  );

  return CardPriceHistory;
};

export default CardPriceHistoryFactory;
