// src/models/Subscription.js

import { DataTypes, Model } from 'sequelize';

/**
 * Factory for Subscription model matching Stripe billing details.
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
        // 'active', 'canceled', 'trialing', 'past_due'
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'active',
      },
      stripeSubId: {
        // Stripe subscription ID
        type: DataTypes.STRING,
        allowNull: true,
      },
      periodEnd: { type: DataTypes.DATE, allowNull: true },
      cancelledAt: { type: DataTypes.DATE, allowNull: true },
      meta: {
        // JSON payload from Stripe or notes
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
        { fields: ['status'] },
      ],
    }
  );

  Subscription.associate = (models) => {
    Subscription.belongsTo(models.User, { foreignKey: 'userId' });
    models.User.hasMany(Subscription, { foreignKey: 'userId' });

    Subscription.belongsTo(models.SubscriptionTier, { foreignKey: 'tierId' });
    models.SubscriptionTier.hasMany(Subscription, { foreignKey: 'tierId' });
  };

  return Subscription;
};
