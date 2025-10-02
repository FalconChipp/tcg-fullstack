// models/CardPrices.js

// --- DEPRECATED --- 
import { DataTypes } from 'sequelize';

export default function CardPriceFactory(sequelize) {
  const CardPrice = sequelize.define(
    'CardPrice',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      cardId: {
        type: DataTypes.STRING(64),
        allowNull: false,
        unique: true, // 1:1 with cards
      },
      currency: {
        type: DataTypes.STRING(3),
        allowNull: false,
        defaultValue: 'GBP',
      },
      lastFetched: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      // Vendor blobs are already GBP-normalized at write time
      tcgplayer: {
        type: DataTypes.JSON, // TEXT on SQLite; JSON on MySQL 5.7+/8
        allowNull: true,
      },
      cardmarket: {
        type: DataTypes.JSON,
        allowNull: true,
      },
    },
    {
      tableName: 'card_prices',
      freezeTableName: true,
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',

      // Important: do NOT name indexes; let Sequelize pick names to avoid collisions
      // If you really want an updated_at index, uncomment the anonymous one below.
      // indexes: [{ fields: ['updated_at'] }],
    }
  );

  return CardPrice;
}
