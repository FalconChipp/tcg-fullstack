import { DataTypes, Model } from 'sequelize';

export default (sequelize) => {
  class Binder extends Model {}

  Binder.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: { type: DataTypes.UUID, allowNull: false },
      name: { type: DataTypes.STRING, allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      coverImage: { type: DataTypes.STRING, allowNull: true },
      accentColor: { type: DataTypes.STRING, allowNull: true },
      visibility: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'private',
      },
      slug: { type: DataTypes.STRING, allowNull: false, unique: true },
      isDeleted: { type: DataTypes.BOOLEAN, defaultValue: false },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'Binder',
      tableName: 'binders',
      timestamps: true,
      indexes: [
        { fields: ['userId'] },
        { fields: ['slug'], unique: true },
      ],
    }
  );

  return Binder;
};
