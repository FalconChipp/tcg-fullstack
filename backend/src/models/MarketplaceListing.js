// models/MarketplaceListing.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const { v4: uuidv4 } = require('uuid');

const MarketplaceListing = sequelize.define('MarketplaceListing', {
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
  cardId: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'card_id',
  },
  quantity: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    allowNull: false,
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  status: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'listed',
  },
}, {
  tableName: 'MarketplaceListings',
  timestamps: true,
  underscored: true,
});

module.exports = MarketplaceListing;
