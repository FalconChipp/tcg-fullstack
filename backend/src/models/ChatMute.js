// src/models/ChatMute.js
//
// UPDATED (2026-01-28):
// - FIX: userId/otherUserId are UUIDs to match User.id in the rest of the app.
// - NOTE: mutedUntil null => muted forever
// - NOTE: unique index (userId, otherUserId) prevents duplicates

export default (sequelize, DataTypes) => {
  const ChatMute = sequelize.define(
    "ChatMute",
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

      otherUserId: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      mutedUntil: {
        type: DataTypes.DATE,
        allowNull: true, // null is forever
      },

      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      tableName: "chat_mutes",
      timestamps: true,
      indexes: [
        { unique: true, fields: ["userId", "otherUserId"] },
        { fields: ["userId"] },
        { fields: ["otherUserId"] },
        { fields: ["mutedUntil"] },
      ],
    }
  );

  // Optional associations (recommended)
  ChatMute.associate = (models) => {
    ChatMute.belongsTo(models.User, { foreignKey: "userId", as: "user" });
    ChatMute.belongsTo(models.User, { foreignKey: "otherUserId", as: "otherUser" });

    models.User.hasMany(ChatMute, { foreignKey: "userId", as: "chatMutes" });
  };

  return ChatMute;
};
