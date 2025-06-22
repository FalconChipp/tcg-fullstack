// models/Binder.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const { v4: uuidv4 } = require('uuid');

const Binder = sequelize.define('Binder', {
  id: {
    type: DataTypes.CHAR(36),
    defaultValue: uuidv4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  userId: {
    type: DataTypes.CHAR(36),
    allowNull: false,
    field: 'user_id',
  },
  description: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  coverImageUrl: {
    type: DataTypes.STRING(255),
    field: 'cover_image_url',
    allowNull: true,
  },
  layout: {
    type: DataTypes.STRING(32),
    allowNull: true,
    defaultValue: '3x3', // Default layout (customize as needed)
  }
}, {
  tableName: 'Binders',
  timestamps: true,
  underscored: true, // creates created_at, updated_at fields
});

module.exports = Binder;
