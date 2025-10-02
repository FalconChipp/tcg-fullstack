// src/models/UserNotificationPref.js — ESM factory (default export)

import { DataTypes } from 'sequelize';

const UserNotificationPrefFactory = (sequelize) => {
  const UserNotificationPref = sequelize.define(
    'UserNotificationPref',
    {
      userId: { type: DataTypes.UUID, primaryKey: true },

      inappEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      emailEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      pushEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },

      // "instant" or "daily" (MVP only uses "instant")
      digest: { type: DataTypes.STRING, allowNull: false, defaultValue: 'instant' },

      // Optional quiet hours (local time strings "22:00", "07:00")
      quietStart: { type: DataTypes.STRING, allowNull: true },
      quietEnd: { type: DataTypes.STRING, allowNull: true },
    },
    {
      tableName: 'user_notification_prefs',
      underscored: false,
      timestamps: true,
    }
  );

  return UserNotificationPref;
};

export default UserNotificationPrefFactory;
