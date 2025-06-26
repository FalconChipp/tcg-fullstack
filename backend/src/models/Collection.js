// src/models/Collection.js

import { DataTypes, Model } from 'sequelize';

/**
 * Collection model factory.
 * @param {Sequelize} sequelize
 * @param {Object} models - { User, Card }
 * @returns {Model}
 */
export default (sequelize, models) => {
  class Collection extends Model {}

  Collection.init(
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
      cardId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      quantity: { type: DataTypes.INTEGER, defaultValue: 1, allowNull: false },
      condition: { type: DataTypes.STRING, allowNull: true }, // e.g. mint, played
      variation: { type: DataTypes.STRING, allowNull: true }, // e.g. holofoil
      wishlist: { type: DataTypes.BOOLEAN, defaultValue: false }, // True if in wishlist, false if in collection
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'Collection',
      tableName: 'collections',
      timestamps: true,
      indexes: [
        {
          fields: ['userId', 'cardId', 'variation'],
          unique: true,
          name: 'unique_user_card_variation'
        }
      ]
    }
  );

  // Associations (should be set up in your loader, but you can export as a function)
  Collection.associate = (models) => {
    Collection.belongsTo(models.User, { foreignKey: 'userId', onDelete: 'CASCADE' });
    Collection.belongsTo(models.Card, { foreignKey: 'cardId', onDelete: 'CASCADE' });
    models.User.hasMany(Collection, { foreignKey: 'userId', onDelete: 'CASCADE' });
    models.Card.hasMany(Collection, { foreignKey: 'cardId', onDelete: 'CASCADE' });
  };

  return Collection;
};
