// src/models/index.js
const sequelize = require('../config/db');
const User = require('./User');
const Card = require('./Card');
const Binder = require('./Binder');
const Collection = require('./Collection');
const Achievement = require('./Achievement');
const UserAchievement = require('./UserAchievement');
const MarketplaceListing = require('./MarketplaceListing');
const UserSession = require('./UserSession');
const UserActivityLog = require('./UserActivityLog');
const Admin = require('./Admin');

// Call this ONCE on startup to sync models
const syncModels = async () => {
  await sequelize.sync({ alter: true });
};

module.exports = {
  sequelize,
  User,
  Card,
  Binder,
  Collection,
  Achievement,
  UserAchievement,
  MarketplaceListing,
  Admin,
  syncModels,
  UserSession,
  UserActivityLog,
};
