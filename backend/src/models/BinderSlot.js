import { DataTypes, Model } from 'sequelize';

export default (sequelize) => {
  class BinderSlot extends Model {
    static associate(models) {
      // Set up correct alias so eager loading 'card' works
      BinderSlot.belongsTo(models.Card, { foreignKey: 'cardId', as: 'card' });
    }
  }

  BinderSlot.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      pageId: { type: DataTypes.UUID, allowNull: false },
      cardId: { type: DataTypes.STRING, allowNull: false },
      quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      position: { type: DataTypes.INTEGER, allowNull: false },
      notes: { type: DataTypes.TEXT, allowNull: true },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'BinderSlot',
      tableName: 'binder_slots',
      timestamps: true,
      indexes: [
        { fields: ['pageId'] },
      ],
    }
  );

  return BinderSlot;
};
