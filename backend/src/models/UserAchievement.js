// models/UserAchievement.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const { v4: uuidv4 } = require('uuid');

const UserAchievement = sequelize.define('UserAchievement', {
  id: {
    type: DataTypes.CHAR(36),
    defaultValue: uuidv4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.CHAR(36),
    allowNull: false,
    field: 'user_id',
  },
  achievementId: {
    type: DataTypes.CHAR(36),
    allowNull: false,
    field: 'achievement_id',
  },
  earnedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'earned_at',
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'UserAchievements',
  timestamps: true,
  underscored: true,
});

module.exports = UserAchievement;
