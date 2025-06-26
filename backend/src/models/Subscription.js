// src/models/Subscription.js

import { DataTypes, Model } from 'sequelize';

/**
 * Factory for Subscription model.
 * @param {Sequelize} sequelize
 * @returns {typeof Model}
 */
export default (sequelize) => {
  class Subscription extends Model {}

  Subscription.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      tierId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      status: {
        // 'active', 'canceled', 'trialing', 'past_due', etc.
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'active',
      },
      startedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      expiresAt: { type: DataTypes.DATE, allowNull: true },
      stripeSubscriptionId: { type: DataTypes.STRING, allowNull: true },
      cancelledAt: { type: DataTypes.DATE, allowNull: true },
      renewalAttemptedAt: { type: DataTypes.DATE, allowNull: true },
      meta: {
        // JSON: for Stripe response, reason for cancellation, etc.
        type: DataTypes.JSON,
        allowNull: true,
      },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'Subscription',
      tableName: 'subscriptions',
      timestamps: true,
      indexes: [
        { fields: ['userId'] },
        { fields: ['tierId'] },
        { fields: ['status'] }
      ]
    }
  );

  // Set up associations in a separate step
  Subscription.associate = (models) => {
    Subscription.belongsTo(models.User, { foreignKey: 'userId' });
    models.User.hasMany(Subscription, { foreignKey: 'userId' });

    Subscription.belongsTo(models.SubscriptionTier, { foreignKey: 'tierId' });
    models.SubscriptionTier.hasMany(Subscription, { foreignKey: 'tierId' });
  };

  return Subscription;
};
