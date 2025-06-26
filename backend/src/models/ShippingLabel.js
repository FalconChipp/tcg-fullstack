// src/models/ShippingLabel.js

import { DataTypes, Model } from 'sequelize';

/**
 * ShippingLabel model factory.
 * @param {Sequelize} sequelize
 * @param {Object} models - All models, e.g. { User }
 * @returns {Model}
 */
export default (sequelize, models) => {
  class ShippingLabel extends Model {}

  ShippingLabel.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        // The owner (seller or buyer) who created the label
        type: DataTypes.UUID,
        allowNull: false,
      },
      externalLabelId: {
        // ID from a third-party shipping provider (e.g., Royal Mail)
        type: DataTypes.STRING,
        allowNull: true,
      },
      trackingNumber: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      carrier: {
        // e.g. 'Royal Mail', 'Evri', 'DPD'
        type: DataTypes.STRING,
        allowNull: true,
      },
      status: {
        // 'created', 'purchased', 'shipped', 'delivered', 'cancelled'
        type: DataTypes.STRING,
        defaultValue: 'created',
        allowNull: false,
      },
      labelUrl: {
        // URL to download/view the label PDF/image
        type: DataTypes.STRING,
        allowNull: true,
      },
      cost: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      meta: {
        // JSON for API payloads, errors, etc.
        type: DataTypes.JSON,
        allowNull: true,
      },
      relatedType: {
        // 'trade', 'listing', etc. (for linking to trade or sale)
        type: DataTypes.STRING,
        allowNull: true,
      },
      relatedId: {
        // ID of trade/listing/etc
        type: DataTypes.UUID,
        allowNull: true,
      },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'ShippingLabel',
      tableName: 'shipping_labels',
      timestamps: true,
      indexes: [
        { fields: ['userId'] },
        { fields: ['trackingNumber'] },
        { fields: ['status'] },
        { fields: ['externalLabelId'] },
      ],
    }
  );

  // --- Associations ---
  ShippingLabel.associate = (models) => {
    ShippingLabel.belongsTo(models.User, { foreignKey: 'userId' });
    models.User.hasMany(ShippingLabel, { foreignKey: 'userId', onDelete: 'CASCADE' });
  };

  return ShippingLabel;
};
