// src/models/User.js
import { DataTypes, Model } from 'sequelize';

export default (sequelize) => {
  class User extends Model {}

  User.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      username: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false,
        validate: { len: [3, 32] },
      },
      email: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false,
        validate: { isEmail: true },
      },
      password: {
        type: DataTypes.STRING,
        allowNull: true, // null if using OAuth only
      },
      googleId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      mfaSecret: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      mfaEnabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      isAdmin: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      isBanned: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      chatBanned: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      reputation: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      lastLogin: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      resetToken: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      resetTokenExpiry: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      verifyToken: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      verifyTokenExpiry: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      emailVerified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'User',
      tableName: 'users',
      timestamps: true,
      indexes: [{ fields: ['email'] }, { fields: ['username'] }],
    }
  );

  return User;
};
