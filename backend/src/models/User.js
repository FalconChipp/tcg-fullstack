// models/User.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const { v4: uuidv4 } = require('uuid');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.CHAR(36),
    defaultValue: uuidv4,
    primaryKey: true,
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
  },
  username: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  avatarUrl: {
    type: DataTypes.STRING(255),
    field: 'avatar_url',
    defaultValue: null,
  },
  isVerified: {
    type: DataTypes.BOOLEAN,
    field: 'is_verified',
    defaultValue: false,
  },
  pendingEmail: {
    type: DataTypes.STRING(255),
    field: 'pending_email',
    defaultValue: null,
  },
  pendingEmailToken: {
    type: DataTypes.STRING(255),
    field: 'pending_email_token',
    defaultValue: null,
  },
  mfaEnabled: {
    type: DataTypes.BOOLEAN,
    field: 'mfa_enabled',
    defaultValue: false,
  },
  mfaSecret: {
    type: DataTypes.STRING(255),
    field: 'mfa_secret',
    defaultValue: null,
  },
  oauthProvider: {
    type: DataTypes.STRING(50),
    field: 'oauth_provider',
    defaultValue: null,
  },
  oauthId: {
    type: DataTypes.STRING(255),
    field: 'oauth_id',
    defaultValue: null,
  },
  isAdmin: {
    type: DataTypes.BOOLEAN,
    field: 'is_admin',
    defaultValue: false,
  },
  lastLoginAt: {
    type: DataTypes.DATE,
    field: 'last_login_at',
    defaultValue: null,
  }
}, {
  tableName: 'Users',
  timestamps: true,
  underscored: true, // creates created_at, updated_at fields
});

module.exports = User;
