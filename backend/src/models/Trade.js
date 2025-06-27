// src/models/Trade.js

import { DataTypes, Model } from 'sequelize';

/**
 * Factory function returning the Trade related models. Associations are
 * configured in models/index.js once all models are instantiated.
 *
 * The Trade model represents the lifecycle of a card trade between two users.
 * Shipping addresses are stored encrypted (encryption implementation is
 * application specific and not included here).
 */
export default (sequelize) => {
  // --- Trade ---
  class Trade extends Model {}
  Trade.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'pending', // pending, confirmed, in_transit, completed, cancelled, disputed
      },
      partyAId: { // first participant
        type: DataTypes.UUID,
        allowNull: false,
      },
      partyBId: { // second participant
        type: DataTypes.UUID,
        allowNull: false,
      },
      initiatorId: { // who created the trade
        type: DataTypes.UUID,
        allowNull: false,
      },
      // Addresses are stored encrypted; actual encryption handled elsewhere
      addressA: { type: DataTypes.TEXT, allowNull: true },
      addressB: { type: DataTypes.TEXT, allowNull: true },
      shippingMethodA: { type: DataTypes.STRING, allowNull: true },
      shippingMethodB: { type: DataTypes.STRING, allowNull: true },
      trackingNumberA: { type: DataTypes.STRING, allowNull: true },
      trackingNumberB: { type: DataTypes.STRING, allowNull: true },
      valueA: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      valueB: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      lockedAt: { type: DataTypes.DATE, allowNull: true },
      completedAt: { type: DataTypes.DATE, allowNull: true },
      cancelledAt: { type: DataTypes.DATE, allowNull: true },
      disputeId: { type: DataTypes.UUID, allowNull: true },
      adminNotes: { type: DataTypes.TEXT, allowNull: true },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'Trade',
      tableName: 'trades',
      timestamps: true,
      indexes: [
        { fields: ['partyAId'] },
        { fields: ['partyBId'] },
        { fields: ['initiatorId'] },
        { fields: ['status'] },
      ],
    }
  );

  // --- TradeCard ---
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
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      cardId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      condition: { type: DataTypes.STRING, allowNull: true },
      notes: { type: DataTypes.TEXT, allowNull: true },
      offeredOrWanted: { type: DataTypes.STRING, allowNull: false }, // 'offered' | 'wanted'
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
        { fields: ['cardId'] },
      ],
    }
  );

  // --- TradeProof ---
  class TradeProof extends Model {}
  TradeProof.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      tradeId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      proofImage: { type: DataTypes.STRING, allowNull: true },
      proofCode: { type: DataTypes.STRING, allowNull: true },
      uploadedAt: { type: DataTypes.DATE, allowNull: true },
      moderatedAt: { type: DataTypes.DATE, allowNull: true },
      moderationResult: { type: DataTypes.STRING, allowNull: true },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'TradeProof',
      tableName: 'trade_proofs',
      timestamps: true,
      indexes: [
        { fields: ['tradeId'] },
        { fields: ['userId'] },
      ],
    }
  );

  // --- TradeDispute ---
  class TradeDispute extends Model {}
  TradeDispute.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      tradeId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      raisedById: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'open', // open, reviewing, resolved, rejected
      },
      reason: { type: DataTypes.TEXT, allowNull: true },
      resolution: { type: DataTypes.TEXT, allowNull: true },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'TradeDispute',
      tableName: 'trade_disputes',
      timestamps: true,
      indexes: [
        { fields: ['tradeId'] },
        { fields: ['raisedById'] },
        { fields: ['status'] },
      ],
    }
  );

  return { Trade, TradeCard, TradeProof, TradeDispute };
};
