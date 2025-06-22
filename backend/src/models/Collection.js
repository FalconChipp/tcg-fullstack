// models/Collection.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const { v4: uuidv4 } = require('uuid');

// This model matches your WordPress plugin's collection table fields
const Collection = sequelize.define('Collection', {
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
    allowNull: false,
    defaultValue: 1,
  },
  condition: {
    type: DataTypes.ENUM('mint', 'near_mint', 'played', 'poor'),
    allowNull: false,
    defaultValue: 'mint',
  },
  variation: {
    type: DataTypes.STRING(100),
    defaultValue: '',
  },
  notes: {
    type: DataTypes.TEXT,
    defaultValue: '',
  },
  tags: {
    type: DataTypes.TEXT,
    defaultValue: '',
  },
  isPublic: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_public',
  },
  wishlist: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  // TCG card metadata fields (denormalized for fast lookups)
  tcgName: {
    type: DataTypes.STRING(255),
    defaultValue: '',
    field: 'tcg_name',
  },
  tcgSetName: {
    type: DataTypes.STRING(255),
    defaultValue: '',
    field: 'tcg_set_name',
  },
  tcgImageUrl: {
    type: DataTypes.STRING(255),
    defaultValue: '',
    field: 'tcg_image_url',
  },
  tcgSetSymbolUrl: {
    type: DataTypes.STRING(255),
    defaultValue: '',
    field: 'tcg_set_symbol_url',
  },
  tcgRarity: {
    type: DataTypes.STRING(50),
    defaultValue: '',
    field: 'tcg_rarity',
  },
  tcgEdition: {
    type: DataTypes.STRING(50),
    defaultValue: '',
    field: 'tcg_edition',
  },
  // Pricing fields
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
  binderId: {
    type: DataTypes.CHAR(36),
    allowNull: true,
    field: 'binder_id',
  },
}, {
  tableName: 'Collections',
  timestamps: true,
  underscored: true, // creates created_at, updated_at fields
});

module.exports = Collection;
