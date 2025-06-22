// models/UserSession.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const { v4: uuidv4 } = require('uuid');

const UserSession = sequelize.define('UserSession', {
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
  jwtId: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'jwt_id',
  },
  deviceInfo: {
    type: DataTypes.STRING(255),
    field: 'device_info',
    allowNull: true,
  },
  ipAddress: {
    type: DataTypes.STRING(255),
    field: 'ip_address',
    allowNull: true,
  },
  createdAt: {
    type: DataTypes.DATE,
    field: 'created_at',
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  expiresAt: {
    type: DataTypes.DATE,
    field: 'expires_at',
    allowNull: true,
  }
}, {
  tableName: 'UserSessions',
  timestamps: false, // Using custom createdAt/expiresAt fields
  underscored: true,
});

module.exports = UserSession;
