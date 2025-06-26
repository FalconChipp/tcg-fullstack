// src/models/SubscriptionTier.js

import { DataTypes, Model } from 'sequelize';

/**
 * Factory for SubscriptionTier model.
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
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      description: { type: DataTypes.TEXT, allowNull: true },
      price: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
      },
      currency: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'GBP'
      },
      stripeProductId: {
        // Stripe product ID for this tier (if used)
        type: DataTypes.STRING,
        allowNull: true,
      },
      stripePriceId: {
        // Stripe price ID for recurring billing
        type: DataTypes.STRING,
        allowNull: true,
      },
      features: {
        // JSON array of feature flags (["canCreateMarketplaceListing", ...])
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: [],
      },
      isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'SubscriptionTier',
      tableName: 'subscription_tiers',
      timestamps: true,
      indexes: [{ fields: ['isActive'] }]
    }
  );

  // Set up associations in a separate step (no associations to define here, but add if needed)
  SubscriptionTier.associate = (models) => {
    // Example if needed in future:
    // SubscriptionTier.hasMany(models.Subscription, { foreignKey: 'tierId' });
  };

  return SubscriptionTier;
};
