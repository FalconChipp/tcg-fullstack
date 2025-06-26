// src/models/Listing.js

import { DataTypes, Model } from 'sequelize';

/**
 * Listing model factory
 * @param {Sequelize} sequelize
 * @param {Object} models - All models, e.g. { User, Card }
 * @returns {Model}
 */
export default (sequelize, models) => {
  class Listing extends Model {}

  Listing.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: { // Seller
        type: DataTypes.UUID,
        allowNull: false,
      },
      cardId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      quantity: { type: DataTypes.INTEGER, defaultValue: 1, allowNull: false },
      price: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      currency: { type: DataTypes.STRING, defaultValue: 'GBP' },
      condition: { type: DataTypes.STRING, allowNull: true },
      variation: { type: DataTypes.STRING, allowNull: true },
      notes: { type: DataTypes.TEXT, allowNull: true },
      status: {
        type: DataTypes.STRING,
        defaultValue: 'active', // active, sold, removed, cancelled, etc.
        allowNull: false,
      },
      shippingLabelUrl: { type: DataTypes.STRING, allowNull: true },
      buyerId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      soldAt: { type: DataTypes.DATE, allowNull: true },
      shippedAt: { type: DataTypes.DATE, allowNull: true },
      completedAt: { type: DataTypes.DATE, allowNull: true },
      cancelledAt: { type: DataTypes.DATE, allowNull: true },
      cancelledReason: { type: DataTypes.STRING, allowNull: true },
      rating: { type: DataTypes.INTEGER, allowNull: true },
      review: { type: DataTypes.STRING, allowNull: true },
      proofCode: { type: DataTypes.STRING, allowNull: true },
      proofImage: { type: DataTypes.STRING, allowNull: true },
      proofUploadedAt: { type: DataTypes.DATE, allowNull: true },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'Listing',
      tableName: 'listings',
      timestamps: true,
      indexes: [
        { fields: ['userId'] },
        { fields: ['cardId'] },
        { fields: ['status'] }
      ]
    }
  );

  // Associations
  Listing.associate = (models) => {
    Listing.belongsTo(models.User, { foreignKey: 'userId', as: 'seller', onDelete: 'CASCADE' });
    Listing.belongsTo(models.Card, { foreignKey: 'cardId', onDelete: 'CASCADE' });
    Listing.belongsTo(models.User, { foreignKey: 'buyerId', as: 'buyer' });

    models.User.hasMany(Listing, { foreignKey: 'userId', as: 'listings', onDelete: 'CASCADE' });
    models.Card.hasMany(Listing, { foreignKey: 'cardId', onDelete: 'CASCADE' });
    models.User.hasMany(Listing, { foreignKey: 'buyerId', as: 'purchases' });
  };

  return Listing;
};
