// models/UserActivityLog.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const { v4: uuidv4 } = require('uuid');

const UserActivityLog = sequelize.define('UserActivityLog', {
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
  type: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  details: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  ip: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  createdAt: {
    type: DataTypes.DATE,
    field: 'created_at',
    allowNull: false,
    defaultValue: DataTypes.NOW,
  }
}, {
  tableName: 'UserActivityLogs',
  timestamps: false, // Using only createdAt field
  underscored: true,
});

module.exports = UserActivityLog;
