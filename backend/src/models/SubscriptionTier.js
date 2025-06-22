// models/SubscriptionTier.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const { v4: uuidv4 } = require('uuid');

const SubscriptionTier = sequelize.define('SubscriptionTier', {
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
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  stripePriceId: {
    type: DataTypes.STRING(255),
    field: 'stripe_price_id',
    allowNull: true,
  },
}, {
  tableName: 'SubscriptionTiers',
  timestamps: false, // Subscription tiers usually don’t need timestamps, add if you want
  underscored: true,
});

module.exports = SubscriptionTier;
