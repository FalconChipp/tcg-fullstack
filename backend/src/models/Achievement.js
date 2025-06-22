// models/Achievement.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const { v4: uuidv4 } = require('uuid');

const Achievement = sequelize.define('Achievement', {
  id: {
    type: DataTypes.CHAR(36),
    defaultValue: uuidv4,
    primaryKey: true,
  },
  code: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  description: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  tier: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  imageUrl: {
    type: DataTypes.STRING(255),
    field: 'image_url',
    allowNull: true,
  },
}, {
  tableName: 'Achievements',
  timestamps: true,
  underscored: true,
});

module.exports = Achievement;
