// src/models/UserPushToken.js

import { DataTypes, Model } from "sequelize";

/**
 * UserPushToken model factory
 * Stores Expo push tokens per user/device
 *
 * MATCHES project factory style: (sequelize, DataTypes)
 */
export default (sequelize, DataTypes) => {
  class UserPushToken extends Model {}

  UserPushToken.init(
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

      expoPushToken: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: {
          notEmpty: true,
        },
      },

      platform: {
        type: DataTypes.STRING(20),
        allowNull: true,
        comment: "android | ios",
      },

      deviceName: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },

      appVersion: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },

      lastSeenAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },

      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },

    {
      sequelize,

      modelName: "UserPushToken",

      tableName: "user_push_tokens",

      timestamps: true,

      indexes: [
        {
          unique: true,
          fields: ["userId", "expoPushToken"],
        },

        {
          fields: ["userId"],
        },

        {
          fields: ["expoPushToken"],
        },

        {
          fields: ["lastSeenAt"],
        },
      ],
    }
  );

  /**
   * Associations
   *
   * IMPORTANT:
   * Your project registers associations in models/index.js,
   * so this is optional — but safe to keep.
   */
  UserPushToken.associate = (models) => {
    UserPushToken.belongsTo(models.User, {
      foreignKey: "userId",
      as: "user",
    });

    models.User.hasMany(UserPushToken, {
      foreignKey: "userId",
      as: "pushTokens",
    });
  };

  return UserPushToken;
};
