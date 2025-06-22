// models/Card.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const { v4: uuidv4 } = require('uuid');

const Card = sequelize.define('Card', {
  id: {
    type: DataTypes.STRING(255), // Cards often use string IDs (not UUID), adjust if needed
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  set: {
    type: DataTypes.STRING(255),
    field: 'set',
    allowNull: true,
  },
  number: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  rarity: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  imageUrl: {
    type: DataTypes.STRING(255),
    field: 'image_url',
    allowNull: true,
  },
  // --- Pricing fields (from TCGPlayer/Cardmarket, can be null) ---
  tcgplayerLow: {
    type: DataTypes.FLOAT,
    field: 'tcgplayer_low',
    defaultValue: null,
  },
  tcgplayerMid: {
    type: DataTypes.FLOAT,
    field: 'tcgplayer_mid',
    defaultValue: null,
  },
  tcgplayerHigh: {
    type: DataTypes.FLOAT,
    field: 'tcgplayer_high',
    defaultValue: null,
  },
  tcgplayerMarket: {
    type: DataTypes.FLOAT,
    field: 'tcgplayer_market',
    defaultValue: null,
  },
  tcgplayerDirectLow: {
    type: DataTypes.FLOAT,
    field: 'tcgplayer_direct_low',
    defaultValue: null,
  },
  cardmarketAverageSell: {
    type: DataTypes.FLOAT,
    field: 'cardmarket_average_sell',
    defaultValue: null,
  },
  cardmarketLowPrice: {
    type: DataTypes.FLOAT,
    field: 'cardmarket_low_price',
    defaultValue: null,
  },
  cardmarketTrendPrice: {
    type: DataTypes.FLOAT,
    field: 'cardmarket_trend_price',
    defaultValue: null,
  },
  // Add more card fields as needed, e.g. for expansion/edition/etc.
}, {
  tableName: 'Cards',
  timestamps: true,
  underscored: true, // creates created_at, updated_at fields
});

module.exports = Card;
