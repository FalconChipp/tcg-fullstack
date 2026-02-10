// src/models/UserDiscordLink.js
import { DataTypes, Model } from "sequelize";

export default (sequelize) => {
  class UserDiscordLink extends Model {}

  UserDiscordLink.init(
    {
      userId: { type: DataTypes.STRING(36), allowNull: false, primaryKey: true },

      discordUserId: { type: DataTypes.STRING(32), allowNull: false, unique: true },
      discordUsername: { type: DataTypes.STRING(100), allowNull: true },
      avatar: { type: DataTypes.STRING(200), allowNull: true },
      linkedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },

      discordAccessTokenEnc: { type: DataTypes.TEXT, allowNull: true }, 
      discordRefreshTokenEnc: { type: DataTypes.TEXT, allowNull: true },
      discordTokenExpiresAt: { type: DataTypes.DATE, allowNull: true },
    },
    {
      sequelize,
      modelName: "UserDiscordLink",
      tableName: "user_discord_links",
      timestamps: false,
    }
  );

  return UserDiscordLink;
};
