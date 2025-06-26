// src/models/Offer.js
import { DataTypes, Model } from 'sequelize';

/**
 * Offer model for marketplace listings
 * @param {Sequelize} sequelize
 */
export default (sequelize) => {
  class Offer extends Model {}
  Offer.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      listingId: { type: DataTypes.UUID, allowNull: false },
      buyerId: { type: DataTypes.UUID, allowNull: false },
      price: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'pending' },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'Offer',
      tableName: 'offers',
      timestamps: true,
      indexes: [
        { fields: ['listingId'] },
        { fields: ['buyerId'] },
        { fields: ['status'] },
      ],
    }
  );

  return Offer;
};
