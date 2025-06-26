// src/models/ReportedUser.js
import { DataTypes, Model } from 'sequelize';

export default (sequelize) => {
  class ReportedUser extends Model {}

  ReportedUser.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: { type: DataTypes.UUID, allowNull: false },
      reporterId: { type: DataTypes.UUID, allowNull: false },
      reason: { type: DataTypes.STRING, allowNull: false },
      isCleared: { type: DataTypes.BOOLEAN, defaultValue: false },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'ReportedUser',
      tableName: 'reported_users',
      timestamps: true,
      indexes: [
        { fields: ['userId'] },
        { fields: ['reporterId'] },
        { fields: ['isCleared'] },
      ],
    }
  );

  return ReportedUser;
};
