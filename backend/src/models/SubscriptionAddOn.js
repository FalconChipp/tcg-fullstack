// src/models/SubscriptionAddOn.js

import { DataTypes, Model } from 'sequelize';

/**
 * Factory for SubscriptionAddOn model representing one-off boosts.
 * @param {Sequelize} sequelize
 * @returns {typeof Model}
 */
export default (sequelize) => {
  class SubscriptionAddOn extends Model {}

  SubscriptionAddOn.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: { type: DataTypes.UUID, allowNull: false },
      type: { type: DataTypes.STRING, allowNull: false },
      quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      expiresAt: { type: DataTypes.DATE, allowNull: true },
      meta: { type: DataTypes.JSON, allowNull: true },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'SubscriptionAddOn',
      tableName: 'subscription_add_ons',
      timestamps: true,
      indexes: [{ fields: ['userId'] }, { fields: ['type'] }],
    }
  );

  SubscriptionAddOn.associate = (models) => {
    SubscriptionAddOn.belongsTo(models.User, { foreignKey: 'userId' });
    models.User.hasMany(SubscriptionAddOn, { foreignKey: 'userId' });
  };

  return SubscriptionAddOn;
};
