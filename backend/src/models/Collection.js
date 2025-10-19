// src/models/Collection.js
import { DataTypes, Model } from "sequelize";

/**
 * Collection model factory (no associations here).
 * Associations are defined centrally in models/index.js.
 */
export default (sequelize) => {
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
        // If your DB column is snake_case, uncomment the next line:
        // field: "user_id",
      },
      cardId: {
        type: DataTypes.STRING,
        allowNull: false,
        // If your DB column is snake_case, uncomment:
        // field: "card_id",
      },
      quantity: { type: DataTypes.INTEGER, defaultValue: 1, allowNull: false },
      condition: { type: DataTypes.STRING, allowNull: true }, // e.g. mint, played
      variation: { type: DataTypes.STRING, allowNull: true }, // e.g. 'normal' | 'reverse' | ...
      wishlist: { type: DataTypes.BOOLEAN, defaultValue: false },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: "Collection",
      tableName: "collections",
      timestamps: true,
      indexes: [
        {
          fields: ["userId", "cardId", "variation"],
          unique: true,
          name: "unique_user_card_variation",
        },
      ],
    }
  );

  // No Collection.associate here — keep it in models/index.js
  return Collection;
};
