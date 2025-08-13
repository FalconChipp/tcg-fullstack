import { DataTypes, Model } from 'sequelize';

// CardPriceHistory model factory
export default (sequelize) => {
  class CardPriceHistory extends Model {}

  CardPriceHistory.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      cardId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      variation: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      tcgplayer: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      cardmarket: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      gbp: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      currency: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      fetchedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'CardPriceHistory',
      tableName: 'card_price_history',
      timestamps: true,
      indexes: [
        { fields: ['cardId'] },
        { fields: ['variation'] },
        { fields: ['fetchedAt'] },
        { fields: ['cardId', 'variation', 'fetchedAt'] },
      ],
    }
  );

  return CardPriceHistory;
};
