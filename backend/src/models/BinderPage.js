import { DataTypes, Model } from 'sequelize';

export default (sequelize) => {
  class BinderPage extends Model {}

  BinderPage.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      binderId: { type: DataTypes.UUID, allowNull: false },
      title: { type: DataTypes.STRING, allowNull: true },
      layout: { type: DataTypes.STRING, allowNull: false, defaultValue: '3x3' },
      pageOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'BinderPage',
      tableName: 'binder_pages',
      timestamps: true,
      indexes: [
        { fields: ['binderId'] },
      ],
    }
  );

  return BinderPage;
};
