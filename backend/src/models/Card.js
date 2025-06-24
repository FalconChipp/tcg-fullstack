// models/Card.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Card = sequelize.define('Card', {
  id: {
    type: DataTypes.STRING(255), // TCGdex and PokemonTCG use string IDs
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  number: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  set: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  setName: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'set_name',
  },
  setLogo: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'set_logo',
  },
  setSymbol: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'set_symbol',
  },
  edition: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  image: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  rarity: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  variations: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  // --- Pricing: Rollup (for quick filters) ---
  pricing: {
    type: DataTypes.JSON, // stores { updated_at, tcgplayer, cardmarket }
    allowNull: true,
  },
  // --- Full TCGplayer/CMKT Variations ---
  tcgplayerVariations: {
    type: DataTypes.JSON, // { normal, reverseHolofoil, holofoil }
    allowNull: true,
    field: 'tcgplayer_variations',
  },
  cardmarketVariations: {
    type: DataTypes.JSON, // { normal, reverseHolofoil, holofoil }
    allowNull: true,
    field: 'cardmarket_variations',
  },
  // --- Legacy quick price fields, kept for backward compatibility ---
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
  }
}, {
  tableName: 'Cards',
  timestamps: true,
  underscored: true,
});

module.exports = Card;
