// src/models/ReportedUser.js
//
// UPDATED (2026-02-06):
// - ADD: `details` column to persist user-provided report context (TEXT, nullable)
// - CHANGE: constrain `reason` to 255 chars to match DB varchar(255)
// - KEEP: tableName, timestamps, indexes, existing fields

import { DataTypes, Model } from "sequelize";

export default (sequelize) => {
  class ReportedUser extends Model {}

  ReportedUser.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },

      userId: { type: DataTypes.UUID, allowNull: false },
      reporterId: { type: DataTypes.UUID, allowNull: false },

      reason: { type: DataTypes.STRING(255), allowNull: false },

      details: { type: DataTypes.TEXT, allowNull: true },

      isCleared: { type: DataTypes.BOOLEAN, defaultValue: false },

      // Keeping explicit timestamps since you already had them
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: "ReportedUser",
      tableName: "reported_users",
      timestamps: true,
      indexes: [
        { fields: ["userId"] },
        { fields: ["reporterId"] },
        { fields: ["isCleared"] },

        // Optional (uncomment if you start filtering by createdAt ranges often)
        // { fields: ["createdAt"] },
      ],
    }
  );

  return ReportedUser;
};
