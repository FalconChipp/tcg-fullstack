// models/Subscription.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const { v4: uuidv4 } = require('uuid');

const Subscription = sequelize.define('Subscription', {
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
  tierId: {
    type: DataTypes.CHAR(36),
    allowNull: false,
    field: 'tier_id',
  },
  stripeSubscriptionId: {
    type: DataTypes.STRING(255),
    field: 'stripe_subscription_id',
    allowNull: true,
  },
  active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false,
  },
  validUntil: {
    type: DataTypes.DATE,
    field: 'valid_until',
    allowNull: true,
  }
}, {
  tableName: 'Subscriptions',
  timestamps: true,
  underscored: true,
});

module.exports = Subscription;
