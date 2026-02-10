// src/models/User.js
// UPDATED (2026-02-05):
// - ADD: safety + parent verification fields so Sequelize can load/save them
// - KEEP: existing fields unchanged

import { DataTypes, Model } from "sequelize";

export default (sequelize) => {
  class User extends Model {}

  User.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      username: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false,
        validate: { len: [3, 32] },
      },
      email: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false,
        validate: { isEmail: true },
      },
      password: {
        type: DataTypes.STRING,
        allowNull: true, // null if using OAuth only
      },
      googleId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      twoFactorSecret: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      twoFactorEnabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      isAdmin: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      isBanned: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      chatBanned: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      reputation: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      lastLogin: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      resetToken: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      resetTokenExpiry: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      verifyToken: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      verifyTokenExpiry: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      referrerId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      emailVerified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },

      /* =========================================================
         SAFETY MODULE FIELDS (ADDED)
      ========================================================= */

      // Date of birth (store as DATE or STRING depending on your DB column type)
      // If your DB column is DATE, use DataTypes.DATEONLY.
      // If your DB column is VARCHAR, use DataTypes.STRING.
      dob: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },

      // Manual override ("child" | "teen" | "none") set by admin
      restriction_level: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      // Parent/guardian email
      parent_email: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: { isEmail: true },
      },

      // Parent approval timestamp
      parent_verified_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },

      // Parent verification token (hashed) + expiry
      parent_verify_token_hash: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      parent_verify_token_expires_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },

      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: "User",
      tableName: "users",
      timestamps: true,
      indexes: [{ fields: ["email"] }, { fields: ["username"] }],
    }
  );

  return User;
};
