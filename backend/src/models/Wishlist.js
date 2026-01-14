// src/models/Wishlist.js

import { DataTypes, Model } from 'sequelize';

// We export a function that takes a sequelize instance and returns the model class
export default (sequelize) => {
  class Wishlist extends Model {}

  Wishlist.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        // associations set up in index.js
      },
      cardId: {
        type: DataTypes.STRING,
        allowNull: false,
        // associations set up in index.js
      },
      status: {
        type: DataTypes.ENUM('ACTIVE', 'GRAIL', 'EVENTUAL', 'UPGRADE'),
        allowNull: false,
        defaultValue: 'ACTIVE',
      },
      variation: { type: DataTypes.STRING, allowNull: true },
      condition: { type: DataTypes.STRING, allowNull: true },
      quantity: { type: DataTypes.INTEGER, defaultValue: 1, allowNull: false },
      notes: { type: DataTypes.TEXT, allowNull: true },
      addedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
      movedToCollectionAt: { type: DataTypes.DATE, allowNull: true },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'Wishlist',
      tableName: 'wishlists',
      timestamps: true,
      indexes: [
        { fields: ['userId'] },
        { fields: ['cardId'] },
        {
          fields: ['userId', 'cardId', 'variation'],
          unique: true,
          name: 'unique_user_card_variation'
        }
      ]
    }
  );

  return Wishlist;
};
