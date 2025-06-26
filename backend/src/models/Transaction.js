// src/models/Transaction.js

import { DataTypes, Model } from 'sequelize';

// DO NOT import sequelize or User here! Do associations in index.js.

export default (sequelize) => {
  class Transaction extends Model {}

  Transaction.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        // The user associated with the transaction (payer)
        type: DataTypes.UUID,
        allowNull: false,
        // references: { model: 'users', key: 'id' }, // Only needed for DB-level FK constraints
        // onDelete: 'CASCADE', // Handled in association in index.js
      },
      relatedType: {
        // 'listing', 'trade', 'subscription', 'withdrawal'
        type: DataTypes.STRING,
        allowNull: false,
      },
      relatedId: {
        // ID of the listing/trade/subscription
        type: DataTypes.UUID,
        allowNull: false,
      },
      stripePaymentIntentId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      stripeChargeId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      currency: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'GBP',
      },
      status: {
        // 'pending', 'completed', 'failed', 'refunded'
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'pending',
      },
      type: {
        // 'payment', 'refund', 'payout'
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'payment',
      },
      meta: {
        // JSON for Stripe response, error, or details
        type: DataTypes.JSON,
        allowNull: true,
      },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'Transaction',
      tableName: 'transactions',
      timestamps: true,
      indexes: [
        { fields: ['userId'] },
        { fields: ['status'] },
        { fields: ['type'] },
        { fields: ['relatedType'] },
        { fields: ['relatedId'] },
      ],
    }
  );

  // Associations are now defined in models/index.js

  return Transaction;
};
