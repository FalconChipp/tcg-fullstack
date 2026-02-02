// src/models/ChatBlock.js
//
// UPDATED (2026-01-28):
// - FIX: blockerId/blockedId are UUIDs to match User.id.
// - NOTE: unique index (blockerId, blockedId) prevents duplicates

export default (sequelize, DataTypes) => {
  const ChatBlock = sequelize.define(
    "ChatBlock",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },

      blockerId: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      blockedId: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      reason: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },

      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      tableName: "chat_blocks",
      timestamps: true,
      indexes: [
        { unique: true, fields: ["blockerId", "blockedId"] },
        { fields: ["blockerId"] },
        { fields: ["blockedId"] },
        { fields: ["createdAt"] },
      ],
    }
  );

  // Optional associations (recommended, since you expose blocker/blocked in GraphQL)
  ChatBlock.associate = (models) => {
    ChatBlock.belongsTo(models.User, { foreignKey: "blockerId", as: "blocker" });
    ChatBlock.belongsTo(models.User, { foreignKey: "blockedId", as: "blocked" });

    models.User.hasMany(ChatBlock, { foreignKey: "blockerId", as: "chatBlocks" });
  };

  return ChatBlock;
};
