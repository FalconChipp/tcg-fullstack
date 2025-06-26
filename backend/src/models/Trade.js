// src/models/Trade.js

import { DataTypes, Model } from 'sequelize';

/**
 * Exports a factory function: pass the sequelize instance, returns Trade & TradeCard models.
 * All associations are to be set up in models/index.js after all models are instantiated.
 */
export default (sequelize) => {
  // --- Trade Model ---
  class Trade extends Model {}
  Trade.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      initiatorId: {
        type: DataTypes.UUID,
        allowNull: false,
        // association set in index.js
      },
      recipientId: {
        type: DataTypes.UUID,
        allowNull: false,
        // association set in index.js
      },
      status: {
        type: DataTypes.STRING,
        defaultValue: 'pending',
        allowNull: false,
      },
      initiatorConfirmed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      recipientConfirmed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      cancelledBy: {
        type: DataTypes.UUID,
        allowNull: true,
        // association set in index.js
      },
      cancelledReason: { type: DataTypes.STRING, allowNull: true },
      completedAt: { type: DataTypes.DATE, allowNull: true },
      trackingNumber: { type: DataTypes.STRING, allowNull: true },
      shippingLabelUrl: { type: DataTypes.STRING, allowNull: true },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'Trade',
      tableName: 'trades',
      timestamps: true,
      indexes: [
        { fields: ['initiatorId'] },
        { fields: ['recipientId'] },
        { fields: ['status'] }
      ]
    }
  );

  // --- TradeCard Model ---
  class TradeCard extends Model {}
  TradeCard.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      tradeId: {
        type: DataTypes.UUID,
        allowNull: false,
        // association set in index.js
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        // association set in index.js
      },
      cardId: {
        type: DataTypes.STRING,
        allowNull: false,
        // association set in index.js (if needed)
      },
      quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      variation: { type: DataTypes.STRING, allowNull: true },
      condition: { type: DataTypes.STRING, allowNull: true },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'TradeCard',
      tableName: 'trade_cards',
      timestamps: true,
      indexes: [
        { fields: ['tradeId'] },
        { fields: ['userId'] },
        { fields: ['cardId'] }
      ]
    }
  );

  // Return both models (named export style in index.js)
  return { Trade, TradeCard };
};
