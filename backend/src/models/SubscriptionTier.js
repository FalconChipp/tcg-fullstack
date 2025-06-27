// src/models/SubscriptionTier.js

import { DataTypes, Model } from 'sequelize';

/**
 * Factory for SubscriptionTier model describing price and benefits.
 * @param {Sequelize} sequelize
 * @returns {typeof Model}
 */
export default (sequelize) => {
  class SubscriptionTier extends Model {}

  SubscriptionTier.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: { type: DataTypes.STRING, allowNull: false, unique: true },
      price: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      interval: { type: DataTypes.STRING, allowNull: false, defaultValue: 'month' },
      featureFlags: { type: DataTypes.JSON, allowNull: true, defaultValue: [] },
      limits: { type: DataTypes.JSON, allowNull: true, defaultValue: {} },
      feeDiscount: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
      shippingDiscount: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
      stripeProductId: { type: DataTypes.STRING, allowNull: true },
      stripePriceId: { type: DataTypes.STRING, allowNull: true },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'SubscriptionTier',
      tableName: 'subscription_tiers',
      timestamps: true,
    }
  );

  SubscriptionTier.associate = () => {};

  return SubscriptionTier;
};
